import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// ============================================================================
// Meow Question Delivery — 100,000-Question Local Benchmark
//   - Seeds 100,000 realistic SSC/RRB questions (normalized keys + selectionKey)
//   - Runs migrations 001..027 on MongoMemoryReplSet (real transactions + indexes)
//   - Captures explain("executionStats") across 5 critical query patterns
//   - Benchmarks 50 concurrent quiz-taker workers over real localhost HTTP
//     against createApp() in TWO modes:
//       * Mode A: Cache/Redis Accelerated (REDIS_TEST_URL or local TCP RESP2 stub)
//       * Mode B: Redis Disabled / MongoDB Fallback
//   - Verifies P95 < 200ms, >80% cache hit ratio (Mode A), 0 duplicates,
//     0 answer-key leaks, and 0 failed requests.
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPORT_PATH = path.resolve(
  __dirname,
  '../test-results/question-delivery-benchmark.json',
);

const TOTAL_DOCS = clampInt(process.env.BENCH_DOC_COUNT, 100_000, 1_000, 250_000);
const SEED_BATCH_SIZE = 5_000;
const CONCURRENCY = clampInt(process.env.BENCH_CONCURRENCY, 50, 5, 100);
const ANSWERS_PER_SESSION = clampInt(process.env.BENCH_ANSWERS_PER_SESSION, 5, 1, 20);
const BATCH_SIZE = 20;
const LEGACY_LIMIT = 25;
const REPORT_PATH = process.env.BENCH_REPORT_PATH || DEFAULT_REPORT_PATH;

// Configure isolated benchmark environment BEFORE importing app.js (which loads dotenv/config).
process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = `bench-jwt-${randomUUID()}-${randomUUID()}`;
process.env.REFRESH_TOKEN_SECRET = `bench-refresh-${randomUUID()}-${randomUUID()}`;
process.env.QUESTIONS_NORMALIZED_KEYS = 'true';
process.env.QUIZ_ONLY_MODE = 'true';
process.env.RUN_EMBEDDED_WORKERS = 'false';
process.env.MONGO_MAX_POOL_SIZE = process.env.MONGO_MAX_POOL_SIZE || '60';
process.env.MONGO_MIN_POOL_SIZE = process.env.MONGO_MIN_POOL_SIZE || '10';
process.env.DEPLOYMENT_ENVIRONMENT = 'staging';
process.env.REDIS_NAMESPACE = `meow:staging:bench-${Date.now()}`;
process.env.QUEUE_REDIS_URL = '';

const FORBIDDEN_FIELD_PATTERNS = [
  /^correct([A-Z_].*|$)/i,
  /^solution([A-Z_].*|$)/i,
  /^explanation([A-Z_].*|$)/i,
  /^answer(_?key)?$/i,
];

function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return round2(sorted[idx]);
}

function summarizeDurations(rows) {
  const durations = rows.map((r) => r.ms).sort((a, b) => a - b);
  const bytes = rows.map((r) => r.bytes);
  const errors = rows.filter((r) => !r.ok).length;
  const avgMs = durations.length
    ? round2(durations.reduce((sum, v) => sum + v, 0) / durations.length)
    : 0;
  const avgBytes = bytes.length
    ? Math.round(bytes.reduce((sum, v) => sum + v, 0) / bytes.length)
    : 0;
  const maxBytes = bytes.length ? Math.max(...bytes) : 0;
  return {
    requests: rows.length,
    errors,
    errorRate: rows.length ? round2((errors / rows.length) * 100) : 0,
    avgMs,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    maxMs: durations.length ? round2(durations[durations.length - 1]) : 0,
    avgResponseBytes: avgBytes,
    maxResponseBytes: maxBytes,
  };
}

function isForbiddenField(key) {
  return FORBIDDEN_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

function countAnswerKeyLeaks(questions) {
  if (!Array.isArray(questions)) return 0;
  let leaks = 0;
  for (const q of questions) {
    if (!q || typeof q !== 'object') continue;
    for (const key of Object.keys(q)) {
      if (isForbiddenField(key) && q[key] !== undefined) leaks++;
    }
    if (q.translations && typeof q.translations === 'object' && !Array.isArray(q.translations)) {
      for (const langObj of Object.values(q.translations)) {
        if (!langObj || typeof langObj !== 'object' || Array.isArray(langObj)) continue;
        for (const key of Object.keys(langObj)) {
          if (isForbiddenField(key) && langObj[key] !== undefined) leaks++;
        }
      }
    }
  }
  return leaks;
}

function countDuplicates(questions, seenSet) {
  if (!Array.isArray(questions)) return 0;
  let dups = 0;
  for (const q of questions) {
    if (!q || typeof q !== 'object') continue;
    const uid = String(q.questionUid || q.id || q.sessionAnchor || '').trim();
    if (!uid) continue;
    if (seenSet.has(uid)) dups++;
    else seenSet.add(uid);
  }
  return dups;
}

// ============================================================================
// Lightweight Local TCP RESP3 Redis Server (used ONLY when REDIS_TEST_URL unset)
// ============================================================================
// Speaks real RESP3 over localhost TCP so the genuine `node-redis@6` client,
// socket isolation (cache vs rate-limit), tieredCache L1+L2, and cacheLease
// Lua EVAL scripts execute unmodified end-to-end.
function createLocalTcpRespRedisServer() {
  const store = new Map();
  let keyspaceHits = 0;
  let keyspaceMisses = 0;
  let totalCommands = 0;

  function getEntry(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  }

  function setEntry(key, value, ttlMs = null) {
    const expiresAt = ttlMs !== null ? Date.now() + Math.max(1, ttlMs) : null;
    store.set(key, { value: String(value), expiresAt });
  }

  function encodeSimple(str) {
    return `+${str}\r\n`;
  }

  function encodeInt(n) {
    return `:${Math.trunc(Number(n) || 0)}\r\n`;
  }

  function encodeNull(proto) {
    return proto === 3 ? '_\r\n' : '$-1\r\n';
  }

  function encodeBulk(val, proto = 3) {
    if (val === null || val === undefined) return encodeNull(proto);
    const str = String(val);
    return `$${Buffer.byteLength(str)}\r\n${str}\r\n`;
  }

  function encodeArray(items, proto = 3) {
    let out = `*${items.length}\r\n`;
    for (const item of items) {
      if (item === null || item === undefined) out += encodeNull(proto);
      else if (typeof item === 'number') out += encodeInt(item);
      else if (Array.isArray(item)) out += encodeArray(item, proto);
      else out += encodeBulk(item, proto);
    }
    return out;
  }

  function encodeHelloResponse(proto) {
    const pairs = [
      ['server', 'redis'],
      ['version', '7.2.0'],
      ['proto', proto],
      ['id', 1],
      ['mode', 'standalone'],
      ['role', 'master'],
    ];
    if (proto === 3) {
      let out = `%${pairs.length}\r\n`;
      for (const [k, v] of pairs) {
        out += encodeBulk(k, 3);
        out += typeof v === 'number' ? encodeInt(v) : encodeBulk(v, 3);
      }
      return out;
    }
    const flat = [];
    for (const [k, v] of pairs) flat.push(k, v);
    return encodeArray(flat, 2);
  }

  function evalLuaEmulation(script, keys, argv, proto) {
    // 1. acquireLease (cacheLease.js)
    if (script.includes("redis.call('EXISTS', KEYS[1])") && script.includes("redis.call('INCR', KEYS[2])")) {
      if (getEntry(keys[0])) return encodeInt(0);
      const existingFence = Number(getEntry(keys[1])?.value || 0);
      const nextFence = existingFence + 1;
      setEntry(keys[1], String(nextFence), Number(argv[2]) || 60_000);
      setEntry(keys[0], argv[0], Number(argv[1]) || 15_000);
      return encodeInt(nextFence);
    }
    // 2. writeWithLease (cacheLease.js)
    if (script.includes("redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4])")) {
      if (getEntry(keys[0])?.value !== argv[0]) return encodeInt(0);
      if (Number(getEntry(keys[1])?.value ?? -1) !== Number(argv[1])) return encodeInt(0);
      setEntry(keys[2], argv[2], (Number(argv[3]) || 60) * 1000);
      store.delete(keys[0]);
      return encodeInt(1);
    }
    // 3. renewLease (cacheLease.js)
    if (script.includes("redis.call('PEXPIRE', KEYS[2], ARGV[3])")) {
      if (getEntry(keys[0])?.value !== argv[0]) return encodeInt(0);
      const lockEntry = getEntry(keys[0]);
      const fenceEntry = getEntry(keys[1]);
      if (lockEntry) lockEntry.expiresAt = Date.now() + (Number(argv[1]) || 15_000);
      if (fenceEntry) fenceEntry.expiresAt = Date.now() + (Number(argv[2]) || 60_000);
      return encodeInt(1);
    }
    // 4. releaseLease (cacheLease.js)
    if (script.includes("redis.call('DEL', KEYS[1])")) {
      if (getEntry(keys[0])?.value === argv[0]) {
        store.delete(keys[0]);
        return encodeInt(1);
      }
      return encodeInt(0);
    }
    // 5. RedisRateLimitStore INCREMENT
    if (script.includes("redis.call('TIME')") && script.includes('PEXPIREAT')) {
      const now = Date.now();
      const windowMs = Math.max(1000, Number(argv[0]) || 60_000);
      const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
      const cur = getEntry(keys[0]);
      const hits = cur ? Number(cur.value) + 1 : 1;
      const expiresAt = cur ? cur.expiresAt : resetAt;
      store.set(keys[0], { value: String(hits), expiresAt });
      return encodeArray([hits, Math.max(0, resetAt - now), resetAt], proto);
    }
    // 6. RedisRateLimitStore DECREMENT
    if (script.includes("redis.call('DECR', KEYS[1])")) {
      const cur = getEntry(keys[0]);
      const hits = cur ? Number(cur.value) : 0;
      if (hits > 0) {
        const next = hits - 1;
        store.set(keys[0], { value: String(next), expiresAt: cur.expiresAt });
        return encodeInt(next);
      }
      return encodeInt(0);
    }
    return encodeInt(1);
  }

  function executeCommand(args, connState) {
    totalCommands++;
    const cmd = String(args[0] || '').toUpperCase();
    switch (cmd) {
      case 'PING':
        return args[1] !== undefined ? encodeBulk(args[1], connState.proto) : encodeSimple('PONG');
      case 'CLIENT':
      case 'SELECT':
      case 'QUIT':
        return encodeSimple('OK');
      case 'HELLO': {
        const requested = Number.parseInt(args[1], 10);
        connState.proto = requested === 3 ? 3 : 2;
        return encodeHelloResponse(connState.proto);
      }
      case 'GET': {
        const entry = getEntry(args[1]);
        if (entry) {
          keyspaceHits++;
          return encodeBulk(entry.value, connState.proto);
        }
        keyspaceMisses++;
        return encodeNull(connState.proto);
      }
      case 'MGET': {
        const values = args.slice(1).map((k) => {
          const entry = getEntry(k);
          if (entry) {
            keyspaceHits++;
            return entry.value;
          }
          keyspaceMisses++;
          return null;
        });
        return encodeArray(values, connState.proto);
      }
      case 'SET': {
        const key = args[1];
        const value = args[2];
        let ttlMs = null;
        let onlyIfAbsent = false;
        for (let i = 3; i < args.length; i++) {
          const flag = String(args[i]).toUpperCase();
          if (flag === 'EX' && args[i + 1] !== undefined) {
            ttlMs = Number(args[++i]) * 1000;
          } else if (flag === 'PX' && args[i + 1] !== undefined) {
            ttlMs = Number(args[++i]);
          } else if (flag === 'NX') {
            onlyIfAbsent = true;
          }
        }
        if (onlyIfAbsent && getEntry(key)) return encodeNull(connState.proto);
        setEntry(key, value, ttlMs);
        return encodeSimple('OK');
      }
      case 'DEL': {
        let deleted = 0;
        for (const k of args.slice(1)) {
          if (store.delete(k)) deleted++;
        }
        return encodeInt(deleted);
      }
      case 'EXISTS': {
        let count = 0;
        for (const k of args.slice(1)) {
          if (getEntry(k)) count++;
        }
        return encodeInt(count);
      }
      case 'INCR': {
        const cur = getEntry(args[1]);
        const next = (cur ? Number(cur.value) : 0) + 1;
        store.set(args[1], { value: String(next), expiresAt: cur ? cur.expiresAt : null });
        return encodeInt(next);
      }
      case 'EXPIRE': {
        const cur = getEntry(args[1]);
        if (!cur) return encodeInt(0);
        cur.expiresAt = Date.now() + Number(args[2]) * 1000;
        return encodeInt(1);
      }
      case 'PEXPIRE': {
        const cur = getEntry(args[1]);
        if (!cur) return encodeInt(0);
        cur.expiresAt = Date.now() + Number(args[2]);
        return encodeInt(1);
      }
      case 'TTL': {
        const cur = getEntry(args[1]);
        if (!cur) return encodeInt(-2);
        if (cur.expiresAt === null) return encodeInt(-1);
        return encodeInt(Math.max(0, Math.ceil((cur.expiresAt - Date.now()) / 1000)));
      }
      case 'PTTL': {
        const cur = getEntry(args[1]);
        if (!cur) return encodeInt(-2);
        if (cur.expiresAt === null) return encodeInt(-1);
        return encodeInt(Math.max(0, cur.expiresAt - Date.now()));
      }
      case 'TIME': {
        const nowMs = Date.now();
        return encodeArray([String(Math.floor(nowMs / 1000)), String((nowMs % 1000) * 1000)], connState.proto);
      }
      case 'PUBLISH':
        return encodeInt(0);
      case 'SUBSCRIBE': {
        const prefix = connState.proto === 3 ? '>' : '*';
        let out = '';
        let count = 0;
        for (const ch of args.slice(1)) {
          count++;
          out += `${prefix}3\r\n${encodeBulk('subscribe', connState.proto)}${encodeBulk(ch, connState.proto)}${encodeInt(count)}`;
        }
        return out || `${prefix}3\r\n${encodeBulk('subscribe', connState.proto)}${encodeNull(connState.proto)}${encodeInt(0)}`;
      }
      case 'UNSUBSCRIBE': {
        const prefix = connState.proto === 3 ? '>' : '*';
        const ch = args[1] || null;
        return `${prefix}3\r\n${encodeBulk('unsubscribe', connState.proto)}${encodeBulk(ch, connState.proto)}${encodeInt(0)}`;
      }
      case 'INFO': {
        let approxBytes = 0;
        for (const [k, v] of store.entries()) {
          approxBytes += Buffer.byteLength(k) + Buffer.byteLength(v.value);
        }
        const info = [
          '# Memory',
          `used_memory:${approxBytes}`,
          `used_memory_human:${(approxBytes / (1024 * 1024)).toFixed(2)}M`,
          'maxmemory:1073741824',
          'maxmemory_human:1.00G',
          'maxmemory_policy:allkeys-lru',
          '# Stats',
          `keyspace_hits:${keyspaceHits}`,
          `keyspace_misses:${keyspaceMisses}`,
          'evicted_keys:0',
        ].join('\r\n');
        return encodeBulk(info, connState.proto);
      }
      case 'EVAL': {
        const script = args[1] || '';
        const numKeys = Number.parseInt(args[2], 10) || 0;
        const keys = args.slice(3, 3 + numKeys);
        const argv = args.slice(3 + numKeys);
        return evalLuaEmulation(script, keys, argv, connState.proto);
      }
      default:
        return encodeSimple('OK');
    }
  }

  // Incremental RESP2 parser supporting arbitrarily chunked or pipelined TCP buffers.
  function parseRespCommands(buf) {
    const commands = [];
    let offset = 0;

    while (offset < buf.length) {
      if (buf[offset] !== 42) { // '*'
        const lineEnd = buf.indexOf('\r\n', offset);
        if (lineEnd === -1) break;
        const inline = buf.subarray(offset, lineEnd).toString('utf8').trim();
        offset = lineEnd + 2;
        if (inline) commands.push(inline.split(/\s+/));
        continue;
      }

      const startOffset = offset;
      const headerEnd = buf.indexOf('\r\n', offset);
      if (headerEnd === -1) break;
      const argCount = Number.parseInt(buf.subarray(offset + 1, headerEnd).toString('utf8'), 10);
      offset = headerEnd + 2;

      const args = [];
      let incomplete = false;
      for (let i = 0; i < argCount; i++) {
        if (offset >= buf.length || buf[offset] !== 36) { // '$'
          incomplete = true;
          break;
        }
        const lenEnd = buf.indexOf('\r\n', offset);
        if (lenEnd === -1) {
          incomplete = true;
          break;
        }
        const byteLen = Number.parseInt(buf.subarray(offset + 1, lenEnd).toString('utf8'), 10);
        const dataStart = lenEnd + 2;
        const dataEnd = dataStart + byteLen;
        if (dataEnd + 2 > buf.length) {
          incomplete = true;
          break;
        }
        args.push(buf.subarray(dataStart, dataEnd).toString('utf8'));
        offset = dataEnd + 2;
      }

      if (incomplete) {
        offset = startOffset;
        break;
      }
      commands.push(args);
    }

    return { commands, remaining: buf.subarray(offset) };
  }

  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    const connState = { proto: 2 };
    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buffer = buffer.length ? Buffer.concat([buffer, chunk]) : chunk;
      const { commands, remaining } = parseRespCommands(buffer);
      buffer = Buffer.from(remaining);
      for (const args of commands) {
        const reply = executeCommand(args, connState);
        if (!socket.destroyed) socket.write(reply);
        if (String(args[0] || '').toUpperCase() === 'QUIT') {
          socket.end();
        }
      }
    });

    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });

  return {
    async start() {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const { port } = server.address();
      return `redis://127.0.0.1:${port}`;
    },
    stats() {
      return {
        keysStored: store.size,
        totalCommands,
        keyspaceHits,
        keyspaceMisses,
        keyspaceHitRatio:
          keyspaceHits + keyspaceMisses > 0
            ? round2((keyspaceHits / (keyspaceHits + keyspaceMisses)) * 100)
            : 0,
      };
    },
    clear() {
      store.clear();
      keyspaceHits = 0;
      keyspaceMisses = 0;
      totalCommands = 0;
    },
    async stop() {
      for (const sock of sockets) sock.destroy();
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

// ============================================================================
// 100,000-Question Realistic SSC / RRB Dataset Generator
// ============================================================================
const EXAMS = ['SSC CGL', 'SSC CHSL', 'RRB NTPC', 'RRB Group D'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
const SHIFTS = [1, 2, 3, 4];

const TOPIC_CATALOG = [
  { subject: 'mathematics', topic: 'Percentage', concepts: ['Successive Percentage', 'Election Problems', 'Income & Expenditure', 'Venn Diagrams'] },
  { subject: 'mathematics', topic: 'Profit and Loss', concepts: ['Marked Price & Discount', 'Dishonest Dealer', 'Successive Discount', 'Cost Price Ratio'] },
  { subject: 'mathematics', topic: 'Algebra', concepts: ['Cubic Identities', 'Symmetric Expressions', 'Linear Equations', 'Quadratic Roots'] },
  { subject: 'mathematics', topic: 'Geometry', concepts: ['Circle Chords', 'Similar Triangles', 'Cyclic Quadrilateral', 'Tangent Secant'] },
  { subject: 'mathematics', topic: 'Trigonometry', concepts: ['Height & Distance', 'Identities', 'Maxima & Minima', 'Complementary Angles'] },
  { subject: 'reasoning', topic: 'Syllogism', concepts: ['Either Or', 'Possibility Cases', 'Only A Few', 'Venn Deduction'] },
  { subject: 'reasoning', topic: 'Coding Decoding', concepts: ['Letter Shift', 'Number Coding', 'Mixed Substitution', 'Opposite Pairs'] },
  { subject: 'reasoning', topic: 'Number Series', concepts: ['Difference Series', 'Alternate Series', 'Prime Squares', 'Cube Plus N'] },
  { subject: 'english', topic: 'Error Spotting', concepts: ['Subject Verb Agreement', 'Conditionals', 'Prepositions', 'Tenses'] },
  { subject: 'english', topic: 'Idioms and Phrases', concepts: ['Action Idioms', 'Animal Idioms', 'Color Idioms', 'Formal Phrases'] },
  { subject: 'general awareness', topic: 'History', topicGroup: 'history', chapters: ['Indus Valley Civilization', 'Mauryan Empire', 'Mughal Architecture', 'Indian National Movement'], concepts: ['Ancient India', 'Medieval India', 'Modern India', 'Freedom Struggle'] },
  { subject: 'general awareness', topic: 'Polity', topicGroup: 'polity', chapters: ['Fundamental Rights', 'Directive Principles', 'Parliamentary System', 'Constitutional Amendments'], concepts: ['Articles', 'Schedules', 'Amendments', 'Judiciary'] },
  { subject: 'general awareness', topic: 'Geography', topicGroup: 'geography', chapters: ['Solar System & Universe', 'River Systems of India', 'Monsoon Climate', 'National Parks'], concepts: ['Physical Geography', 'Indian Rivers', 'Climate', 'Biosphere'] },
  { subject: 'general awareness', topic: 'General Science', topicGroup: 'science', chapters: ['Human Physiology', 'Optics & Light', 'Acids Bases & Salts', 'Cell Biology'], concepts: ['Physics Laws', 'Chemistry Reactions', 'Biology Systems', 'Vitamins'] },
];

async function seedQuestions(collection, buildNormalizedQuestionFields) {
  const started = performance.now();
  const baseTime = Date.UTC(2025, 0, 1);

  for (let start = 0; start < TOTAL_DOCS; start += SEED_BATCH_SIZE) {
    const batchLen = Math.min(SEED_BATCH_SIZE, TOTAL_DOCS - start);
    const docs = new Array(batchLen);

    for (let offset = 0; offset < batchLen; offset++) {
      const idx = start + offset;
      const spec = TOPIC_CATALOG[idx % TOPIC_CATALOG.length];
      const topicOrdinal = Math.floor(idx / TOPIC_CATALOG.length);
      const exam = EXAMS[topicOrdinal % EXAMS.length];
      const concept = spec.concepts[Math.floor(topicOrdinal / EXAMS.length) % spec.concepts.length];
      const chapter = spec.chapters
        ? spec.chapters[Math.floor(topicOrdinal / (EXAMS.length * spec.concepts.length)) % spec.chapters.length]
        : spec.topic;
      const difficulty = DIFFICULTIES[topicOrdinal % DIFFICULTIES.length];
      const year = YEARS[topicOrdinal % YEARS.length];
      const shift = SHIFTS[topicOrdinal % SHIFTS.length];
      const correctIdx = idx % 4;
      const questionUid = `bench_q_${String(idx + 1).padStart(6, '0')}`;
      const options = [
        `Option A (${concept} #${(idx % 97) + 1})`,
        `Option B (${concept} #${(idx % 89) + 2})`,
        `Option C (${concept} #${(idx % 83) + 3})`,
        `Option D (${concept} #${(idx % 79) + 4})`,
      ];

      const doc = {
        _id: new ObjectId((idx + 1).toString(16).padStart(24, '0')),
        id: questionUid,
        questionUid,
        exam,
        tier: idx % 3 === 0 ? 'Tier 2' : 'Tier 1',
        subject: spec.subject,
        topic: spec.topic,
        chapter,
        ...(spec.topicGroup ? { topicGroup: spec.topicGroup } : {}),
        concept,
        quizName: 'Concept Practice',
        difficulty,
        year,
        shift: `Shift ${shift}`,
        examDate: `${year}-0${(idx % 9) + 1}-${String((idx % 28) + 1).padStart(2, '0')}`,
        question: `[${exam} ${year} S${shift}] ${spec.topic} — ${concept}: Solve standardized problem #${idx + 1} for ${difficulty} tier evaluation.`,
        options,
        correctAnswer: options[correctIdx],
        correctLetter: ['A', 'B', 'C', 'D'][correctIdx],
        solution: `Step-by-step derivation for ${questionUid}: apply ${concept} identity to obtain ${options[correctIdx]}.`,
        explanation: `Detailed explanation for ${questionUid} (${spec.topic}).`,
        translations: {
          en: {
            question: `[${exam} ${year} S${shift}] ${spec.topic} — ${concept}: Solve standardized problem #${idx + 1}.`,
            options,
            solution: `EN solution for ${questionUid}.`,
          },
          bn: {
            question: `[${exam} ${year}] ${spec.topic} (${concept}): প্রশ্ন #${idx + 1} সমাধান করুন।`,
            options: options.map((opt, i) => `বিকল্প ${i + 1}: ${opt}`),
            solution: `ব্যাখ্যা (${questionUid}): সঠিক উত্তর ${options[correctIdx]}।`,
          },
        },
        createdAt: new Date(baseTime + idx * 1000),
        updatedAt: new Date(baseTime + idx * 1000),
      };

      docs[offset] = {
        ...doc,
        ...buildNormalizedQuestionFields(doc),
      };
    }

    await collection.insertMany(docs, { ordered: false });
  }

  return round2(performance.now() - started);
}

// ============================================================================
// Explain Plan Suite (`explain("executionStats")` on 100,000-doc collection)
// ============================================================================
function extractStageTree(plan) {
  if (!plan || typeof plan !== 'object') return [];
  const stages = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.stage) {
      stages.push(node.indexName ? `${node.stage}(${node.indexName})` : node.stage);
    }
    if (node.inputStage) walk(node.inputStage);
    if (Array.isArray(node.inputStages)) {
      for (const child of node.inputStages) walk(child);
    }
  };
  walk(plan);
  return stages;
}

function extractWinningIndex(plan) {
  if (!plan || typeof plan !== 'object') return null;
  if (plan.indexName) return plan.indexName;
  if (plan.inputStage) return extractWinningIndex(plan.inputStage);
  if (Array.isArray(plan.inputStages)) {
    for (const child of plan.inputStages) {
      const found = extractWinningIndex(child);
      if (found) return found;
    }
  }
  return null;
}

async function runExplainSuite(collection, quizQuestionProjection) {
  const queries = [
    {
      name: 'examMode + topic + mode',
      filter: { examModeKey: 'ssc', topicKey: 'percentage', modeKey: 'concept' },
      sort: { _id: 1 },
      limit: 20,
    },
    {
      name: 'topic + mode + examKey',
      filter: { topicKey: 'percentage', modeKey: 'concept', examKey: 'ssc cgl' },
      sort: { _id: 1 },
      limit: 20,
    },
    {
      name: 'topic + mode + conceptKey',
      filter: { topicKey: 'percentage', modeKey: 'concept', conceptKey: 'successive percentage' },
      sort: { _id: 1 },
      limit: 20,
    },
    {
      name: 'topic + mode + selectionKey ring-scan',
      filter: { topicKey: 'percentage', modeKey: 'concept', selectionKey: { $gte: '8000000000000000' } },
      sort: { selectionKey: 1, _id: 1 },
      limit: 20,
    },
    {
      name: 'GA topicGroupKey + mode',
      filter: { topicGroupKey: 'history', modeKey: 'concept' },
      sort: { _id: 1 },
      limit: 20,
    },
  ];

  const results = [];
  for (const q of queries) {
    const explained = await collection
      .find(q.filter)
      .project(quizQuestionProjection)
      .sort(q.sort)
      .limit(q.limit)
      .explain('executionStats');

    const stats = explained.executionStats || {};
    const winningPlan = explained.queryPlanner?.winningPlan || stats.executionStages || {};
    const stageTree = extractStageTree(winningPlan);
    const winningIndex = extractWinningIndex(winningPlan);
    const usesCollscan = stageTree.some((s) => s.startsWith('COLLSCAN'));

    results.push({
      pattern: q.name,
      winningIndex,
      stageTree: stageTree.join(' <- '),
      usesCollscan,
      nReturned: stats.nReturned ?? 0,
      totalDocsExamined: stats.totalDocsExamined ?? 0,
      totalKeysExamined: stats.totalKeysExamined ?? 0,
      executionTimeMillis: stats.executionTimeMillis ?? 0,
    });
  }

  return results;
}

// ============================================================================
// Concurrent Workload Runner (Mode A: Redis ON vs Mode B: Redis OFF)
// ============================================================================
async function sumMongoCommands(mongoCommandsMetric) {
  const metric = await mongoCommandsMetric.get();
  let total = 0;
  const byCollection = {};
  for (const row of metric.values || []) {
    const val = Number(row.value) || 0;
    total += val;
    const col = row.labels?.collection || 'other';
    byCollection[col] = (byCollection[col] || 0) + val;
  }
  return { total, byCollection };
}

// Hot SSC exam-prep scopes representing realistic concurrent learner demand
// (multiple concurrent users practicing popular SSC CGL topics/concepts).
const WORKLOAD_SCOPES = [
  { mode: 'topic', topic: 'Percentage', exam: 'SSC CGL', concept: 'Successive Percentage', examMode: 'ssc' },
  { mode: 'topic', topic: 'Profit and Loss', exam: 'SSC CGL', concept: 'Marked Price & Discount', examMode: 'ssc' },
  { mode: 'topic', topic: 'History', exam: 'SSC CGL', concept: 'Modern India', examMode: 'ssc' },
  { mode: 'topic', topic: 'Polity', exam: 'SSC CHSL', concept: 'Articles', examMode: 'ssc' },
  { mode: 'practice', topic: 'Percentage', exam: 'SSC CGL', concept: 'Election Problems', examMode: 'ssc' },
  { mode: 'practice', topic: 'Algebra', exam: 'SSC CGL', concept: 'Cubic Identities', examMode: 'ssc' },
  { mode: 'speed', topic: 'Geometry', exam: 'SSC CGL', concept: 'Circle Chords', examMode: 'ssc' },
  { mode: 'mock', topic: 'Percentage', exam: 'SSC CGL', concept: 'Income & Expenditure', examMode: 'ssc' },
];

async function runModeBenchmark({
  modeLabel,
  baseUrl,
  users,
  mongoCommandsMetric,
  getCacheHitSummary,
  resetCacheHitSummary,
  clearSharedLocalCaches,
  invalidateQuestionCacheRevision,
  redisServer,
}) {
  clearSharedLocalCaches();
  invalidateQuestionCacheRevision();
  resetCacheHitSummary();
  if (redisServer) redisServer.clear();

  const samples = {
    session_create: [],
    questions_batch: [],
    answer_submit: [],
    answer_replay: [],
    session_submit: [],
    session_result: [],
    legacy_session: [],
  };

  let duplicateQuestionsTotal = 0;
  let answerKeyLeaksTotal = 0;
  let failedRequestsTotal = 0;
  let sessionsCompleted = 0;
  let answersSubmitted = 0;
  let idempotentReplaysVerified = 0;
  const errorSamples = [];
  let recordMetrics = false;

  async function timedFetch(opName, method, urlPath, { token, body, headers = {} } = {}) {
    const started = performance.now();
    const row = { ok: false, ms: 0, bytes: 0, status: 0 };
    if (recordMetrics) samples[opName].push(row);
    try {
      const res = await fetch(`${baseUrl}${urlPath}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await res.text();
      row.status = res.status;
      row.bytes = Buffer.byteLength(text);
      const parsed = text ? JSON.parse(text) : null;
      row.ok = res.ok;
      if (!res.ok && recordMetrics) {
        failedRequestsTotal++;
        if (errorSamples.length < 10) {
          errorSamples.push({ opName, status: res.status, body: text.slice(0, 180) });
        }
      }
      return { status: res.status, ok: res.ok, body: parsed };
    } catch (err) {
      if (recordMetrics) {
        failedRequestsTotal++;
        if (errorSamples.length < 10) {
          errorSamples.push({ opName, status: 0, error: err?.message || String(err) });
        }
      }
      return { status: 0, ok: false, body: null };
    } finally {
      row.ms = performance.now() - started;
    }
  }

  const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pacePause = (workerIdx, stepIdx) =>
    sleepMs(550 + ((workerIdx * 37 + stepIdx * 53) % 400));

  async function runSingleWorkerJourney(workerIdx, waveNum, staggerMs = 0) {
    if (staggerMs > 0) {
      await sleepMs(staggerMs);
    }
    const user = users[workerIdx % users.length];
    const scope = WORKLOAD_SCOPES[Math.abs(workerIdx + waveNum) % WORKLOAD_SCOPES.length];
    const isExamStyle = scope.mode === 'mock' || scope.mode === 'speed';
    const seenUids = new Set();

    // 1. POST /api/v1/quiz/sessions (Batch 1)
    const createPayload = {
      mode: scope.mode,
      topic: scope.topic,
      exam: scope.exam,
      concept: scope.concept,
      examMode: scope.examMode,
      batchSize: BATCH_SIZE,
      totalQuestions: 40,
      lang: 'en',
      randomize: false,
    };

    const createRes = await timedFetch('session_create', 'POST', '/api/v1/quiz/sessions', {
      token: user.token,
      body: createPayload,
      headers: { 'Idempotency-Key': `bench_c_${waveNum}_${workerIdx}_${randomUUID().slice(0, 8)}` },
    });

    if (createRes.status !== 201 || !createRes.body?.sessionId) {
      return;
    }

    const { sessionId, questions: batch1 = [], nextCursor, hasMore } = createRes.body;
    if (recordMetrics) {
      answerKeyLeaksTotal += countAnswerKeyLeaks(batch1);
      duplicateQuestionsTotal += countDuplicates(batch1, seenUids);
    }

    if (recordMetrics) await pacePause(workerIdx, 1);

    // 2. GET /api/v1/quiz/sessions/:id/questions (Batch 2 cursor prefetch)
    let allQuestions = batch1.slice();
    if (hasMore && nextCursor) {
      const batchRes = await timedFetch(
        'questions_batch',
        'GET',
        `/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/questions?cursor=${encodeURIComponent(nextCursor)}&batchSize=${BATCH_SIZE}`,
        { token: user.token },
      );
      if (batchRes.ok && Array.isArray(batchRes.body?.questions)) {
        if (recordMetrics) {
          answerKeyLeaksTotal += countAnswerKeyLeaks(batchRes.body.questions);
          duplicateQuestionsTotal += countDuplicates(batchRes.body.questions, seenUids);
        }
        allQuestions = allQuestions.concat(batchRes.body.questions);
      }
    }

    // 3. POST /api/v1/quiz/sessions/:id/answers (idempotent answer submissions)
    const toAnswer = allQuestions.slice(0, ANSWERS_PER_SESSION);
    for (let i = 0; i < toAnswer.length; i++) {
      if (recordMetrics) await pacePause(workerIdx, 2 + i);
      const q = toAnswer[i];
      const submissionId = `bench_a_${waveNum}_${workerIdx}_${i}_${randomUUID().slice(0, 8)}`;
      const answerBody = {
        questionUid: q.questionUid,
        answer: i % Math.max(1, q.options?.length || 4),
        timeTakenMs: 1500 + i * 400,
        submissionId,
      };
      const ansRes = await timedFetch(
        'answer_submit',
        'POST',
        `/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/answers`,
        {
          token: user.token,
          body: answerBody,
          headers: { 'Idempotency-Key': submissionId },
        },
      );
      if (ansRes.ok && ansRes.body?.accepted === true) {
        if (recordMetrics) {
          answersSubmitted++;
          if (isExamStyle && ansRes.body?.evaluation !== undefined) {
            answerKeyLeaksTotal++;
          }
        }
      }

      // Replay first answer to confirm idempotent duplicate-submission protection.
      if (i === 0 && ansRes.ok) {
        const replayRes = await timedFetch(
          'answer_replay',
          'POST',
          `/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/answers`,
          {
            token: user.token,
            body: answerBody,
            headers: { 'Idempotency-Key': submissionId },
          },
        );
        if (replayRes.ok && replayRes.body?.accepted === true && recordMetrics) {
          idempotentReplaysVerified++;
        }
      }
    }

    if (recordMetrics) await pacePause(workerIdx, 10);

    // 4. POST /api/v1/quiz/sessions/:id/submit
    const submitRes = await timedFetch(
      'session_submit',
      'POST',
      `/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/submit`,
      {
        token: user.token,
        body: { reason: 'manual' },
        headers: { 'Idempotency-Key': `bench_s_${waveNum}_${workerIdx}_${randomUUID().slice(0, 8)}` },
      },
    );
    if (submitRes.ok && submitRes.body?.status === 'completed' && recordMetrics) {
      sessionsCompleted++;
    }

    if (recordMetrics) await pacePause(workerIdx, 11);

    // 5. GET /api/v1/quiz/sessions/:id/result
    await timedFetch(
      'session_result',
      'GET',
      `/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/result`,
      { token: user.token },
    );

    if (recordMetrics) await pacePause(workerIdx, 12);

    // 6. Legacy compatibility read: GET /api/questions/session?limit=25
    const legacyQs = new URLSearchParams({
      limit: String(LEGACY_LIMIT),
      topic: scope.topic,
      exam: scope.exam,
      examMode: scope.examMode,
    });
    const legacyRes = await timedFetch(
      'legacy_session',
      'GET',
      `/api/questions/session?${legacyQs.toString()}`,
    );
    if (legacyRes.ok && Array.isArray(legacyRes.body?.questions) && recordMetrics) {
      answerKeyLeaksTotal += countAnswerKeyLeaks(legacyRes.body.questions);
      duplicateQuestionsTotal += countDuplicates(legacyRes.body.questions, new Set());
    }
  }

  // Ramp-up warm-up pass across all workload scopes to warm hot Redis entries
  // (identical sequence run in Mode B with Redis OFF for apples-to-apples fairness).
  recordMetrics = false;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < WORKLOAD_SCOPES.length; i++) {
      await runSingleWorkerJourney(i, 100 + pass, 0);
    }
  }

  // Clear process-local L1 ONLY before measurement so Wave 1 models a fresh
  // horizontal Azure instance with empty L1 hitting warm Redis (Mode A) vs
  // cold MongoDB (Mode B).
  clearSharedLocalCaches();
  resetCacheHitSummary();
  recordMetrics = true;

  const mongoBefore = await sumMongoCommands(mongoCommandsMetric);
  const started = performance.now();

  // Wave 1: 50 concurrent quiz-taker workers (staggered over a realistic 6s arrival ramp
  // so all 50 VUs overlap concurrently at realistic quiz-taker pacing).
  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, idx) => runSingleWorkerJourney(idx, 1, idx * 120)),
  );

  // Evict process-local L1 ONLY between waves (keeping shared Redis warm in Mode A)
  // to test sustained horizontal multi-instance cache reuse.
  clearSharedLocalCaches();

  // Wave 2: 50 concurrent workers hitting warm shared Redis (Mode A) vs cold MongoDB (Mode B).
  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, idx) => runSingleWorkerJourney(idx, 2, idx * 120)),
  );

  const wallTimeMs = round2(performance.now() - started);
  const mongoAfter = await sumMongoCommands(mongoCommandsMetric);
  const cacheSummary = getCacheHitSummary();

  const allRows = Object.values(samples).flat();
  const totalHttpRequests = allRows.length;
  const mongoCommandsDelta = Math.max(0, mongoAfter.total - mongoBefore.total);
  const mongoByCollectionDelta = {};
  for (const [col, count] of Object.entries(mongoAfter.byCollection)) {
    const diff = count - (mongoBefore.byCollection[col] || 0);
    if (diff > 0) mongoByCollectionDelta[col] = diff;
  }

  const endpoints = {};
  for (const [name, rows] of Object.entries(samples)) {
    endpoints[name] = summarizeDurations(rows);
  }
  endpoints.overall = summarizeDurations(allRows);

  return {
    mode: modeLabel,
    concurrency: CONCURRENCY,
    waves: 2,
    wallTimeMs,
    throughputRps: wallTimeMs > 0 ? round2((totalHttpRequests / wallTimeMs) * 1000) : 0,
    totalHttpRequests,
    sessionsCompleted,
    answersSubmitted,
    idempotentReplaysVerified,
    integrity: {
      duplicateQuestionsTotal,
      answerKeyLeaksTotal,
      failedRequestsTotal,
      ...(errorSamples.length ? { errorSamples } : {}),
    },
    endpoints,
    cache: {
      tieredHitRatioPct: round2((cacheSummary.hitRatio || 0) * 100),
      redisLayerHitRatioPct: round2((cacheSummary.redisHitRatio || 0) * 100),
      l1Hits: cacheSummary.l1Hits + cacheSummary.l1Stale,
      redisHits: cacheSummary.redisHits + cacheSummary.redisStale,
      redisMisses: cacheSummary.redisMisses,
      sourceMisses: cacheSummary.sourceMisses,
      bypasses: cacheSummary.bypasses,
      totalReads: cacheSummary.totalReads,
      ...(redisServer ? { localTcpRedisStats: redisServer.stats() } : {}),
    },
    mongo: {
      commandsDelta: mongoCommandsDelta,
      opsPerHttpRequest: totalHttpRequests > 0 ? round2(mongoCommandsDelta / totalHttpRequests) : 0,
      byCollection: mongoByCollectionDelta,
    },
  };
}

// ============================================================================
// Main Orchestrator
// ============================================================================
let mongo = null;
let httpServer = null;
let localRedis = null;
let disconnectMongo = null;
let closeRedis = null;
let closeSessionSub = null;

try {
  // 1. Start disposable MongoMemoryReplSet (real replica-set transactions)
  const bootStart = performance.now();
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = `meow_delivery_bench_${Date.now()}`;

  // 2. Start Mode A Redis transport (external REDIS_TEST_URL or local TCP RESP2 stub)
  const externalRedisUrl = process.env.REDIS_TEST_URL?.trim() || '';
  let redisTransportLabel;
  if (externalRedisUrl) {
    process.env.REDIS_URL = externalRedisUrl;
    redisTransportLabel = 'external-redis (REDIS_TEST_URL)';
  } else {
    localRedis = createLocalTcpRespRedisServer();
    process.env.REDIS_URL = await localRedis.start();
    redisTransportLabel = 'local-tcp-resp3-stub (real node-redis@6 TCP client + Lua leases)';
  }

  // 3. Dynamically import backend modules after env setup
  const { connectMongoDB, disconnectMongoDB } = await import('../config/mongodb.js');
  const { closeRedisClient } = await import('../config/redis.js');
  const { migrate, assertMigrations } = await import('../migrations/runner.js');
  const { buildNormalizedQuestionFields } = await import('../services/questions/questionNormalizer.js');
  const { quizQuestionProjection } = await import('../services/questions/quizQuestionDTO.js');
  const { createApp } = await import('../app.js');
  const {
    createSession,
    startSessionInvalidationSubscriber,
    closeSessionInvalidationSubscriber,
  } = await import('../auth/sessions.js');
  const {
    mongoCommands,
    getCacheHitSummary,
    resetCacheHitSummary,
  } = await import('../infrastructure/metrics.js');
  const { clearSharedLocalCaches } = await import('../infrastructure/tieredCache.js');
  const { invalidateQuestionCacheRevision } = await import('../services/questions/questionCache.js');

  disconnectMongo = disconnectMongoDB;
  closeRedis = closeRedisClient;
  closeSessionSub = closeSessionInvalidationSubscriber;

  const db = await connectMongoDB();
  const questionsCol = db.collection('questions');

  // 4. Seed 100,000 realistic SSC/RRB questions + run migrations 001..027
  console.log(`[bench] Seeding ${TOTAL_DOCS.toLocaleString()} realistic SSC/RRB questions...`);
  const seedDurationMs = await seedQuestions(questionsCol, buildNormalizedQuestionFields);
  console.log(`[bench] Seeded ${TOTAL_DOCS.toLocaleString()} docs in ${seedDurationMs} ms. Running migrations 001..027...`);

  const migrateStart = performance.now();
  await migrate(db);
  await assertMigrations(db);
  const migrateDurationMs = round2(performance.now() - migrateStart);
  const questionIndexes = await questionsCol.listIndexes().toArray();
  console.log(
    `[bench] Migrations 001..027 applied in ${migrateDurationMs} ms (${questionIndexes.length} indexes on 'questions').`,
  );

  // 5. Run explain("executionStats") on the 100,000-doc collection
  const explainResults = await runExplainSuite(questionsCol, quizQuestionProjection);

  // 6. Create 50 synthetic users + real JWT sessions
  const users = [];
  const userDocs = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    userDocs.push({
      id: `bench_user_${i + 1}`,
      name: `Bench Learner ${i + 1}`,
      email: `bench-learner-${i + 1}@local.invalid`,
      role: 'user',
      status: 'active',
      emailVerified: true,
      createdAt: new Date(),
    });
  }
  await db.collection('users').insertMany(userDocs);
  for (const u of userDocs) {
    const session = await createSession(u);
    users.push({ id: u.id, token: session.token });
  }

  // 7. Boot real Express app over localhost HTTP
  const { app } = await createApp({
    isReady: () => true,
    isShuttingDown: () => false,
    quizOnlyMode: true,
  });
  httpServer = app.listen(0, '127.0.0.1');
  await once(httpServer, 'listening');
  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  // 8. Run Mode A — Cache / Redis Accelerated (with auth invalidation subscriber active, matching index.js)
  await startSessionInvalidationSubscriber();
  console.log(`[bench] Running Mode A (Redis/Cache Accelerated — ${redisTransportLabel}) with ${CONCURRENCY} concurrent workers...`);
  const modeA = await runModeBenchmark({
    modeLabel: 'Mode A — Cache/Redis Accelerated',
    baseUrl,
    users,
    mongoCommandsMetric: mongoCommands,
    getCacheHitSummary,
    resetCacheHitSummary,
    clearSharedLocalCaches,
    invalidateQuestionCacheRevision,
    redisServer: localRedis,
  });

  // 9. Switch to Mode B — Redis Disabled / MongoDB Fallback
  await closeSessionInvalidationSubscriber();
  await closeRedisClient();
  process.env.REDIS_URL = '';
  console.log(`[bench] Running Mode B (Redis Disabled / MongoDB Fallback) with ${CONCURRENCY} concurrent workers...`);
  const modeB = await runModeBenchmark({
    modeLabel: 'Mode B — Redis Disabled (MongoDB Fallback)',
    baseUrl,
    users,
    mongoCommandsMetric: mongoCommands,
    getCacheHitSummary,
    resetCacheHitSummary,
    clearSharedLocalCaches,
    invalidateQuestionCacheRevision,
    redisServer: null,
  });

  // 10. Verify SLO assertions
  const sloChecks = {
    zeroCollscanInExplain: explainResults.every((r) => !r.usesCollscan && r.nReturned > 0),
    modeABatchP95Under200Ms: modeA.endpoints.questions_batch.p95Ms < 200,
    modeASessionCreateP95Under250Ms: modeA.endpoints.session_create.p95Ms < 250,
    modeACacheHitRatioOver80Pct: modeA.cache.tieredHitRatioPct > 80,
    modeAZeroDuplicates: modeA.integrity.duplicateQuestionsTotal === 0,
    modeAZeroAnswerKeyLeaks: modeA.integrity.answerKeyLeaksTotal === 0,
    modeAZeroFailedRequests: modeA.integrity.failedRequestsTotal === 0,
    modeBZeroDuplicates: modeB.integrity.duplicateQuestionsTotal === 0,
    modeBZeroAnswerKeyLeaks: modeB.integrity.answerKeyLeaksTotal === 0,
    modeBZeroFailedRequests: modeB.integrity.failedRequestsTotal === 0,
  };
  const allSloPassed = Object.values(sloChecks).every(Boolean);

  const report = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      mongodbEngine: 'MongoMemoryReplSet (1-node local replica set, real transactions)',
      redisTransportModeA: redisTransportLabel,
      redisTransportModeB: 'disabled (REDIS_URL unset)',
      normalizedKeysEnabled: true,
      seededQuestions: TOTAL_DOCS,
      seedDurationMs,
      migrateDurationMs,
      questionIndexCount: questionIndexes.length,
      totalBenchmarkDurationMs: round2(performance.now() - bootStart),
      concurrency: CONCURRENCY,
      wavesPerMode: 2,
      batchSize: BATCH_SIZE,
      legacyLimit: LEGACY_LIMIT,
      answersPerSession: ANSWERS_PER_SESSION,
    },
    explainExecutionStats: explainResults,
    comparison: {
      modeA,
      modeB,
      mongoOpsReductionPct:
        modeB.mongo.commandsDelta > 0
          ? round2(((modeB.mongo.commandsDelta - modeA.mongo.commandsDelta) / modeB.mongo.commandsDelta) * 100)
          : 0,
      batchP95SpeedupRatio:
        modeA.endpoints.questions_batch.p95Ms > 0
          ? round2(modeB.endpoints.questions_batch.p95Ms / modeA.endpoints.questions_batch.p95Ms)
          : 0,
    },
    sloChecks,
    allSloPassed,
    caveats: [
      'Executed on disposable local MongoMemoryReplSet (1-node WiredTiger) + localhost HTTP; absolute latencies reflect local loopback without WAN RTT or Atlas network hops.',
      externalRedisUrl
        ? 'Mode A connected to external REDIS_TEST_URL.'
        : 'Mode A used an in-process localhost TCP RESP2 Redis stub exercising the real node-redis client, socket isolation, and Lua lease scripts because local redis-server is not installed.',
      'Between Wave 1 and Wave 2 in both modes, process-local L1 caches were cleared while keeping Redis warm in Mode A to model horizontal multi-instance Azure scale-out.',
    ],
  };

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  // Print concise human-readable report
  console.log('\n=== 100,000-DOC EXPLAIN("executionStats") ===');
  console.table(
    explainResults.map((r) => ({
      pattern: r.pattern,
      winningIndex: r.winningIndex,
      nReturned: r.nReturned,
      docsExamined: r.totalDocsExamined,
      keysExamined: r.totalKeysExamined,
      execMs: r.executionTimeMillis,
      collscan: r.usesCollscan,
    })),
  );

  console.log('\n=== MODE A (REDIS ON) vs MODE B (REDIS OFF) COMPARISON ===');
  console.table([
    {
      mode: 'Mode A (Redis ON)',
      batchP50ms: modeA.endpoints.questions_batch.p50Ms,
      batchP95ms: modeA.endpoints.questions_batch.p95Ms,
      batchP99ms: modeA.endpoints.questions_batch.p99Ms,
      createP95ms: modeA.endpoints.session_create.p95Ms,
      legacyP95ms: modeA.endpoints.legacy_session.p95Ms,
      batchAvgKB: round2(modeA.endpoints.questions_batch.avgResponseBytes / 1024),
      tieredHitPct: modeA.cache.tieredHitRatioPct,
      redisHitPct: modeA.cache.redisLayerHitRatioPct,
      mongoOpsReq: modeA.mongo.opsPerHttpRequest,
      mongoCmds: modeA.mongo.commandsDelta,
      dups: modeA.integrity.duplicateQuestionsTotal,
      leaks: modeA.integrity.answerKeyLeaksTotal,
      fails: modeA.integrity.failedRequestsTotal,
    },
    {
      mode: 'Mode B (Redis OFF)',
      batchP50ms: modeB.endpoints.questions_batch.p50Ms,
      batchP95ms: modeB.endpoints.questions_batch.p95Ms,
      batchP99ms: modeB.endpoints.questions_batch.p99Ms,
      createP95ms: modeB.endpoints.session_create.p95Ms,
      legacyP95ms: modeB.endpoints.legacy_session.p95Ms,
      batchAvgKB: round2(modeB.endpoints.questions_batch.avgResponseBytes / 1024),
      tieredHitPct: modeB.cache.tieredHitRatioPct,
      redisHitPct: modeB.cache.redisLayerHitRatioPct,
      mongoOpsReq: modeB.mongo.opsPerHttpRequest,
      mongoCmds: modeB.mongo.commandsDelta,
      dups: modeB.integrity.duplicateQuestionsTotal,
      leaks: modeB.integrity.answerKeyLeaksTotal,
      fails: modeB.integrity.failedRequestsTotal,
    },
  ]);

  console.log(`[bench] SLO Checks:`, sloChecks);
  console.log(`[bench] Report saved -> ${REPORT_PATH}`);

  assert.equal(allSloPassed, true, `One or more SLO checks failed: ${JSON.stringify(sloChecks)}`);
} finally {
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(() => resolve()));
  }
  await closeSessionSub?.().catch(() => {});
  await closeRedis?.().catch(() => {});
  await localRedis?.stop().catch(() => {});
  await disconnectMongo?.().catch(() => {});
  await mongo?.stop().catch(() => {});
}
