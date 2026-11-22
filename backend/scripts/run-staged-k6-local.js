import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

// ============================================================================
// Meow R5 Local Staged k6 Benchmark Harness (Self-Contained & Isolated)
// ============================================================================
// - Boots offline MongoMemoryReplSet (1-node replica set, real transactions)
// - Applies migrations 001..029 via runner.js
// - Seeds isolated synthetic dataset:
//     * 150 active users (pre-hashed bcrypt cost-12 + active JWT sessions)
//     * 1,600 normalized SSC questions (with trainingMetadata + selectionKey)
//     * Curated 100-question SSC CGL Tier 1 mock slot (`cgl-mock-bench-1`)
//     * Active battle season + 150 battle & season leaderboard profiles
//     * Public catalogs (topicCountSnapshots + mockCatalogMetadata)
// - Starts real Express API (`createApp` + `http.createServer` + `listenServer`)
//   on 127.0.0.1:0 with local TCP RESP3 Redis stub (real node-redis@6 client)
// - Runs `load-tests/k6/meow-production-readiness.js` progressively across all
//   7 stages (30, 100, 250, 500, 750, 1000, 1200–1500 VUs)
// - Samples Node process CPU%, RSS/heapUsed, event-loop lag (p50/p95/p99/max),
//   and Prometheus `/metrics` before/during/after each stage
// - Audits MongoDB data integrity directly after EVERY stage
// - Writes `load-tests/k6/results-local-readiness-<stage>.json` and
//   `load-tests/k6/results-local-readiness-summary.json`
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const K6_SCRIPT_PATH = path.resolve(REPO_ROOT, 'load-tests/k6/meow-production-readiness.js');
const RESULTS_DIR = path.resolve(REPO_ROOT, 'load-tests/k6');

const DEFAULT_STAGES = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];
const BENCH_PASSWORD = 'LocalBench!Pass#2026';

function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function parseCliArgs(argv) {
  const opts = {
    stages: null,
    stageDuration: process.env.STAGE_DURATION || '25s',
    rampDuration: process.env.RAMP_DURATION || '6s',
    cooldownDuration: process.env.COOLDOWN_DURATION || '5s',
    thinkTimeScale: process.env.THINK_TIME_SCALE || '1.0',
    userCount: clampInt(process.env.BENCH_USERS, 150, 30, 500),
    questionCount: clampInt(process.env.BENCH_QUESTIONS, 1600, 400, 20000),
    stage7TargetVus: clampInt(process.env.STAGE7_TARGET_VUS, 1500, 1200, 1500),
    authJourneyWeight: clampInt(process.env.AUTH_JOURNEY_WEIGHT, 6, 1, 30),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--stages' && argv[i + 1]) {
      opts.stages = argv[++i].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    } else if (arg === '--duration' && argv[i + 1]) {
      opts.stageDuration = argv[++i];
    } else if (arg === '--ramp' && argv[i + 1]) {
      opts.rampDuration = argv[++i];
    } else if (arg === '--cooldown' && argv[i + 1]) {
      opts.cooldownDuration = argv[++i];
    } else if (arg === '--think-scale' && argv[i + 1]) {
      opts.thinkTimeScale = argv[++i];
    } else if (arg === '--users' && argv[i + 1]) {
      opts.userCount = clampInt(argv[++i], 150, 30, 500);
    } else if (arg === '--questions' && argv[i + 1]) {
      opts.questionCount = clampInt(argv[++i], 1600, 400, 20000);
    } else if (arg === '--stage7-vus' && argv[i + 1]) {
      opts.stage7TargetVus = clampInt(argv[++i], 1500, 1200, 1500);
    }
  }

  if (!opts.stages) {
    const envStages = String(process.env.BENCH_STAGES || '').trim();
    opts.stages = envStages
      ? envStages.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : DEFAULT_STAGES;
  }

  return opts;
}

const CLI_OPTS = parseCliArgs(process.argv.slice(2));

// Set isolated test-only environment BEFORE importing app.js (which loads dotenv/config).
// Never read or depend on .env* secrets.
process.env.NODE_ENV = 'production';
process.env.DEPLOYMENT_ENVIRONMENT = 'staging';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = `local-r5-jwt-${randomUUID()}-${randomUUID()}`;
process.env.REFRESH_TOKEN_SECRET = `local-r5-refresh-${randomUUID()}-${randomUUID()}`;
process.env.METRICS_TOKEN = `local-r5-metrics-${randomUUID()}`;
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.GOOGLE_CLIENT_ID = 'synthetic-local-bench-client-id.invalid';
process.env.GOOGLE_CLIENT_SECRET = 'synthetic-local-bench-client-secret';
process.env.GOOGLE_CALLBACK_URL = 'http://127.0.0.1:10000/auth/google/callback';
process.env.QUESTIONS_NORMALIZED_KEYS = 'true';
process.env.TRAINING_INDEXED_QUESTIONS = 'true';
process.env.QUIZ_ONLY_MODE = 'false';
process.env.RUN_EMBEDDED_WORKERS = 'false';
process.env.RUN_CONCEPT_GROUPING_WORKER = 'false';
process.env.AUTH_BCRYPT_WORKERS = 'true';
process.env.MONGO_MAX_POOL_SIZE = process.env.MONGO_MAX_POOL_SIZE || '100';
process.env.MONGO_MIN_POOL_SIZE = process.env.MONGO_MIN_POOL_SIZE || '15';
process.env.REDIS_COMMANDS_QUEUE_MAX = '8192';
process.env.REDIS_COMMAND_TIMEOUT_MS = '2000';
process.env.REDIS_NAMESPACE = `meow:staging:bench-r5-${Date.now()}`;
process.env.QUEUE_REDIS_URL = '';

// ============================================================================
// Lightweight Local TCP RESP3 Redis Server
// ============================================================================
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

  const encodeSimple = (str) => `+${str}\r\n`;
  const encodeInt = (n) => `:${Math.trunc(Number(n) || 0)}\r\n`;
  const encodeNull = (proto) => (proto === 3 ? '_\r\n' : '$-1\r\n');
  const encodeBulk = (val, proto = 3) => {
    if (val === null || val === undefined) return encodeNull(proto);
    const str = String(val);
    return `$${Buffer.byteLength(str)}\r\n${str}\r\n`;
  };
  const encodeArray = (items, proto = 3) => {
    let out = `*${items.length}\r\n`;
    for (const item of items) {
      if (item === null || item === undefined) out += encodeNull(proto);
      else if (typeof item === 'number') out += encodeInt(item);
      else if (Array.isArray(item)) out += encodeArray(item, proto);
      else out += encodeBulk(item, proto);
    }
    return out;
  };

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
    if (script.includes("redis.call('EXISTS', KEYS[1])") && script.includes("redis.call('INCR', KEYS[2])")) {
      if (getEntry(keys[0])) return encodeInt(0);
      const existingFence = Number(getEntry(keys[1])?.value || 0);
      const nextFence = existingFence + 1;
      setEntry(keys[1], String(nextFence), Number(argv[2]) || 60_000);
      setEntry(keys[0], argv[0], Number(argv[1]) || 15_000);
      return encodeInt(nextFence);
    }
    if (script.includes("redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4])")) {
      if (getEntry(keys[0])?.value !== argv[0]) return encodeInt(0);
      if (Number(getEntry(keys[1])?.value ?? -1) !== Number(argv[1])) return encodeInt(0);
      setEntry(keys[2], argv[2], (Number(argv[3]) || 60) * 1000);
      store.delete(keys[0]);
      return encodeInt(1);
    }
    if (script.includes("redis.call('PEXPIRE', KEYS[2], ARGV[3])")) {
      if (getEntry(keys[0])?.value !== argv[0]) return encodeInt(0);
      const lockEntry = getEntry(keys[0]);
      const fenceEntry = getEntry(keys[1]);
      if (lockEntry) lockEntry.expiresAt = Date.now() + (Number(argv[1]) || 15_000);
      if (fenceEntry) fenceEntry.expiresAt = Date.now() + (Number(argv[2]) || 60_000);
      return encodeInt(1);
    }
    if (script.includes("redis.call('DEL', KEYS[1])")) {
      if (getEntry(keys[0])?.value === argv[0]) {
        store.delete(keys[0]);
        return encodeInt(1);
      }
      return encodeInt(0);
    }
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
          if (flag === 'EX' && args[i + 1] !== undefined) ttlMs = Number(args[++i]) * 1000;
          else if (flag === 'PX' && args[i + 1] !== undefined) ttlMs = Number(args[++i]);
          else if (flag === 'NX') onlyIfAbsent = true;
        }
        if (onlyIfAbsent && getEntry(key)) return encodeNull(connState.proto);
        setEntry(key, value, ttlMs);
        return encodeSimple('OK');
      }
      case 'DEL':
      case 'UNLINK': {
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
      case 'PEXPIREAT': {
        const cur = getEntry(args[1]);
        if (!cur) return encodeInt(0);
        cur.expiresAt = Number(args[2]);
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

  function parseRespCommands(buf) {
    const commands = [];
    let offset = 0;
    while (offset < buf.length) {
      if (buf[offset] !== 42) {
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
        if (offset >= buf.length || buf[offset] !== 36) {
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
        if (String(args[0] || '').toUpperCase() === 'QUIT') socket.end();
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
    clearRateLimitKeys() {
      for (const key of store.keys()) {
        if (key.includes(':rate:v2:')) store.delete(key);
      }
    },
    stats() {
      return {
        keysStored: store.size,
        totalCommands,
        keyspaceHits,
        keyspaceMisses,
        keyspaceHitRatioPct:
          keyspaceHits + keyspaceMisses > 0
            ? round2((keyspaceHits / (keyspaceHits + keyspaceMisses)) * 100)
            : 0,
      };
    },
    async stop() {
      for (const sock of sockets) {
        try { sock.destroy(); } catch { /* ignore */ }
      }
      sockets.clear();
      await Promise.race([
        new Promise((resolve) => server.close(() => resolve())),
        new Promise((resolve) => {
          const t = setTimeout(resolve, 3000);
          t.unref();
        }),
      ]);
    },
  };
}

// ============================================================================
// Synthetic Dataset Seeder (Isolated Local Benchmark Data)
// ============================================================================
const TOPIC_CATALOG = [
  { subject: 'mathematics', topic: 'Percentage', sectionKey: 'quant', concepts: ['Successive Percentage', 'Election Problems', 'Income & Expenditure'] },
  { subject: 'mathematics', topic: 'Profit and Loss', sectionKey: 'quant', concepts: ['Marked Price & Discount', 'Dishonest Dealer', 'Successive Discount'] },
  { subject: 'mathematics', topic: 'Algebra', sectionKey: 'quant', concepts: ['Cubic Identities', 'Symmetric Expressions', 'Quadratic Roots'] },
  { subject: 'mathematics', topic: 'Geometry', sectionKey: 'quant', concepts: ['Circle Chords', 'Similar Triangles', 'Cyclic Quadrilateral'] },
  { subject: 'reasoning', topic: 'Syllogism', sectionKey: 'reasoning', concepts: ['Either Or', 'Possibility Cases', 'Only A Few'] },
  { subject: 'reasoning', topic: 'Coding Decoding', sectionKey: 'reasoning', concepts: ['Letter Shift', 'Number Coding', 'Mixed Substitution'] },
  { subject: 'reasoning', topic: 'Number Series', sectionKey: 'reasoning', concepts: ['Difference Series', 'Alternate Series', 'Prime Squares'] },
  { subject: 'english', topic: 'Error Spotting', sectionKey: 'english', concepts: ['Subject Verb Agreement', 'Conditionals', 'Prepositions'] },
  { subject: 'english', topic: 'Idioms and Phrases', sectionKey: 'english', concepts: ['Action Idioms', 'Formal Phrases', 'Color Idioms'] },
  { subject: 'general awareness', topic: 'History', sectionKey: 'ga', topicGroup: 'history', chapter: 'Modern India', concepts: ['Ancient India', 'Medieval India', 'Modern India'] },
  { subject: 'general awareness', topic: 'Polity', sectionKey: 'ga', topicGroup: 'polity', chapter: 'Fundamental Rights', concepts: ['Articles', 'Schedules', 'Amendments'] },
  { subject: 'general awareness', topic: 'Geography', sectionKey: 'ga', topicGroup: 'geography', chapter: 'River Systems of India', concepts: ['Indian Rivers', 'Climate', 'Biosphere'] },
];

const EXAMS = ['SSC CGL', 'SSC CHSL', 'RRB NTPC'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

async function seedIsolatedBenchmarkData(db, {
  userCount,
  questionCount,
  buildNormalizedQuestionFields,
  trainingQuestionMetadata,
  hashPassword,
  createSession,
  initializePublicCatalogs,
}) {
  const seedStart = performance.now();
  const baseTime = Date.UTC(2026, 0, 1);

  // 1. Seed synthetic normalized questions with training metadata
  const questionDocs = new Array(questionCount);
  for (let i = 0; i < questionCount; i++) {
    const spec = TOPIC_CATALOG[i % TOPIC_CATALOG.length];
    const exam = EXAMS[i % EXAMS.length];
    const concept = spec.concepts[Math.floor(i / TOPIC_CATALOG.length) % spec.concepts.length];
    const difficulty = DIFFICULTIES[i % DIFFICULTIES.length];
    const year = 2020 + (i % 6);
    const shift = (i % 4) + 1;
    const correctIdx = i % 4;
    const questionUid = `r5_q_${String(i + 1).padStart(6, '0')}`;
    const options = [
      `Option A (${concept} #${(i % 73) + 1})`,
      `Option B (${concept} #${(i % 67) + 2})`,
      `Option C (${concept} #${(i % 61) + 3})`,
      `Option D (${concept} #${(i % 59) + 4})`,
    ];

    const raw = {
      _id: new ObjectId((i + 1).toString(16).padStart(24, '0')),
      id: questionUid,
      questionUid,
      exam,
      tier: i % 3 === 0 ? 'Tier 2' : 'Tier 1',
      subject: spec.subject,
      topic: spec.topic,
      chapter: spec.chapter || spec.topic,
      ...(spec.topicGroup ? { topicGroup: spec.topicGroup } : {}),
      concept,
      quizName: 'Concept Practice',
      difficulty,
      year,
      shift: `Shift ${shift}`,
      examDate: `${year}-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
      question: `[${exam} ${year} S${shift}] ${spec.topic} — ${concept}: Synthetic benchmark question #${i + 1}.`,
      options,
      correctAnswer: options[correctIdx],
      correctLetter: ['A', 'B', 'C', 'D'][correctIdx],
      solution: `Step-by-step synthetic solution for ${questionUid}: answer is ${options[correctIdx]}.`,
      explanation: `Synthetic explanation for ${questionUid}.`,
      createdAt: new Date(baseTime + i * 1000),
      updatedAt: new Date(baseTime + i * 1000),
    };

    questionDocs[i] = {
      ...raw,
      ...buildNormalizedQuestionFields(raw),
      ...trainingQuestionMetadata(raw),
    };
  }
  await db.collection('questions').insertMany(questionDocs, { ordered: false });

  // 2. Seed curated 100-question SSC CGL Tier 1 mock slot (`cgl-mock-bench-1`)
  const fixedQuestions = [];
  const sectionSpecs = [
    { key: 'ga', subject: 'general awareness', topic: 'History' },
    { key: 'reasoning', subject: 'reasoning', topic: 'Syllogism' },
    { key: 'quant', subject: 'mathematics', topic: 'Percentage' },
    { key: 'english', subject: 'english', topic: 'Error Spotting' },
  ];
  let mqIndex = 1;
  for (const sec of sectionSpecs) {
    for (let j = 0; j < 25; j++) {
      const qId = `cgl_mock_b1_q${mqIndex++}`;
      const options = [`Option A (${sec.key} ${j + 1})`, `Option B (${sec.key} ${j + 1})`, `Option C (${sec.key} ${j + 1})`, `Option D (${sec.key} ${j + 1})`];
      fixedQuestions.push({
        id: qId,
        questionUid: qId,
        sectionKey: sec.key,
        subject: sec.subject,
        topic: sec.topic,
        questionType: 'MCQ',
        difficulty: DIFFICULTIES[j % 3],
        question: `[SSC CGL Mock Bench] ${sec.topic} problem #${j + 1}`,
        options,
        correctAnswer: options[j % 4],
        correctLetter: ['A', 'B', 'C', 'D'][j % 4],
        solution: `Mock solution for ${qId}`,
      });
    }
  }

  await db.collection('mockSlots').updateOne(
    { id: 'cgl-mock-bench-1', examSlug: 'ssc-cgl' },
    {
      $set: {
        id: 'cgl-mock-bench-1',
        examSlug: 'ssc-cgl',
        configKey: 'ssc-cgl-tier1',
        title: 'SSC CGL Tier I Synthetic Load Benchmark Paper 1',
        tier: 'Tier I',
        type: 'mock',
        isPyq: false,
        year: 2026,
        isFree: true,
        order: 1,
        assessmentMode: 'practice',
        questionCount: fixedQuestions.length,
        fixedQuestions,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  // Initialize topic count snapshots and mock catalog metadata from seeded collections
  await initializePublicCatalogs();

  // 3. Seed synthetic active users (real bcrypt cost-12 hash) + real JWT sessions
  const passwordHash = await hashPassword(BENCH_PASSWORD, 12);
  const userDocs = [];
  for (let i = 0; i < userCount; i++) {
    userDocs.push({
      id: `r5_user_${i + 1}`,
      name: `Bench Learner ${i + 1}`,
      email: `bench-r5-user-${i + 1}@local.invalid`,
      role: 'student',
      authProvider: 'local',
      passwordHash,
      emailVerified: true,
      status: 'active',
      progress: {},
      bookmarks: [],
      bookmarkEntries: [],
      recentQuizzes: [],
      createdAt: new Date().toISOString(),
    });
  }
  await db.collection('users').insertMany(userDocs);

  const accounts = [];
  for (const u of userDocs) {
    const session = await createSession({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
    });
    accounts.push({
      userId: u.id,
      email: u.email,
      password: BENCH_PASSWORD,
      token: session.token,
    });
  }

  // 4. Seed active battle season & 150 battle/season leaderboard profiles
  const now = new Date();
  const seasonSlug = 'season-r5-bench-2026';
  await db.collection('battleSeasons').insertOne({
    key: seasonSlug,
    name: 'Benchmark Season 2026',
    startsAt: new Date(now.getTime() - 7 * 86_400_000),
    endsAt: new Date(now.getTime() + 30 * 86_400_000),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  const battleProfiles = [];
  const seasonProfiles = [];
  for (let i = 0; i < userCount; i++) {
    const rating = 1100 + ((i * 37) % 1000);
    const gamesPlayed = 5 + (i % 25);
    const wins = Math.floor(gamesPlayed * 0.6);
    const losses = gamesPlayed - wins;
    battleProfiles.push({
      userId: `r5_user_${i + 1}`,
      displayName: `Bench Learner ${i + 1}`,
      rating,
      peakRating: rating + 40,
      gamesPlayed,
      wins,
      losses,
      draws: 0,
      currentWinStreak: i % 5,
      bestWinStreak: 5,
      updatedAt: now,
    });
    seasonProfiles.push({
      seasonKey: seasonSlug,
      userId: `r5_user_${i + 1}`,
      displayName: `Bench Learner ${i + 1}`,
      rating,
      peakRating: rating + 20,
      tier: rating >= 1700 ? 'Diamond' : rating >= 1400 ? 'Gold' : 'Silver',
      gamesPlayed,
      wins,
      losses,
      draws: 0,
      currentWinStreak: i % 4,
      bestWinStreak: 4,
      updatedAt: now,
    });
  }
  await db.collection('battleProfiles').insertMany(battleProfiles);
  await db.collection('battleSeasonProfiles').insertMany(seasonProfiles);

  return {
    accounts,
    seedDurationMs: round2(performance.now() - seedStart),
    seeded: {
      users: userCount,
      questions: questionCount,
      mockSlotId: 'cgl-mock-bench-1',
      battleSeasonKey: seasonSlug,
      battleProfiles: userCount,
    },
  };
}

// ============================================================================
// Prometheus `/metrics` Scraper & Histogram Quantile Helper
// ============================================================================
function parsePrometheusSnapshot(text) {
  const snap = {
    l1Hits: 0,
    l1Stale: 0,
    l1Misses: 0,
    redisHits: 0,
    redisStale: 0,
    redisMisses: 0,
    sourceMisses: 0,
    bypasses: 0,
    mongoPoolWaiting: 0,
    mongoCommandsTotal: 0,
    redisFallbacksTotal: 0,
    mongoLatencyBuckets: new Map(), // le -> count
    mongoLatencySum: 0,
    mongoLatencyCount: 0,
  };

  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/.exec(trimmed);
    if (!match) continue;
    const [, name, rawLabels, rawVal] = match;
    const val = Number(rawVal);
    if (!Number.isFinite(val)) continue;

    if (name === 'meow_cache_operations_total') {
      const layer = /layer="([^"]+)"/.exec(rawLabels || '')?.[1];
      const outcome = /outcome="([^"]+)"/.exec(rawLabels || '')?.[1];
      if (outcome === 'bypass') snap.bypasses += val;
      else if (layer === 'l1') {
        if (outcome === 'hit') snap.l1Hits += val;
        else if (outcome === 'stale') snap.l1Stale += val;
        else if (outcome === 'miss') snap.l1Misses += val;
      } else if (layer === 'redis') {
        if (outcome === 'hit') snap.redisHits += val;
        else if (outcome === 'stale') snap.redisStale += val;
        else if (outcome === 'miss') snap.redisMisses += val;
      } else if (layer === 'source' && outcome === 'miss') {
        snap.sourceMisses += val;
      }
    } else if (name === 'meow_mongo_pool_waiting') {
      snap.mongoPoolWaiting = val;
    } else if (name === 'meow_mongo_commands_total') {
      snap.mongoCommandsTotal += val;
    } else if (name === 'meow_redis_fallback_total') {
      snap.redisFallbacksTotal += val;
    } else if (name === 'meow_mongo_command_duration_seconds_bucket') {
      const le = /le="([^"]+)"/.exec(rawLabels || '')?.[1];
      if (le) {
        snap.mongoLatencyBuckets.set(le, (snap.mongoLatencyBuckets.get(le) || 0) + val);
      }
    } else if (name === 'meow_mongo_command_duration_seconds_sum') {
      snap.mongoLatencySum += val;
    } else if (name === 'meow_mongo_command_duration_seconds_count') {
      snap.mongoLatencyCount += val;
    }
  }
  return snap;
}

function estimateHistogramQuantileMs(beforeBuckets, afterBuckets, q) {
  const entries = [];
  for (const [le, afterCount] of afterBuckets.entries()) {
    const beforeCount = beforeBuckets.get(le) || 0;
    const delta = Math.max(0, afterCount - beforeCount);
    const bound = le === '+Inf' ? Infinity : Number(le);
    entries.push({ bound, count: delta });
  }
  entries.sort((a, b) => a.bound - b.bound);
  const total = entries.length ? entries[entries.length - 1].count : 0;
  if (total <= 0) return 0;

  const target = total * q;
  let prevBound = 0;
  let prevCount = 0;
  for (const { bound, count } of entries) {
    if (count >= target) {
      if (!Number.isFinite(bound)) return round2(prevBound * 1000);
      const bucketSpan = count - prevCount;
      if (bucketSpan <= 0) return round2(bound * 1000);
      const frac = (target - prevCount) / bucketSpan;
      return round2((prevBound + (bound - prevBound) * frac) * 1000);
    }
    prevBound = bound;
    prevCount = count;
  }
  return 0;
}

async function scrapeMetricsViaHttp(baseUrl, token) {
  const res = await fetch(`${baseUrl}/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  const text = await res.text();
  return parsePrometheusSnapshot(text);
}

// ============================================================================
// Direct MongoDB Data Integrity Audit After Each Stage
// ============================================================================
async function runMongoIntegrityAudit(db) {
  // 1. quizSessions: check duplicate questionUid in questionIds or answers anomalies
  const quizSessionsCol = db.collection('quizSessions');
  const [totalQuizSessions, completedQuizSessions, missingResultCompletedQuiz, quizAnswerDupAgg] =
    await Promise.all([
      quizSessionsCol.countDocuments({}),
      quizSessionsCol.countDocuments({ status: 'completed' }),
      quizSessionsCol.countDocuments({ status: 'completed', $or: [{ result: null }, { result: { $exists: false } }] }),
      quizSessionsCol
        .aggregate([
          { $project: { _id: 1, qCount: { $size: { $ifNull: ['$questionIds', []] } }, uCount: { $size: { $setUnion: [{ $ifNull: ['$questionIds', []] }, []] } } } },
          { $match: { $expr: { $ne: ['$qCount', '$uCount'] } } },
          { $count: 'count' },
        ])
        .toArray(),
    ]);
  const duplicateQuizQuestionSessions = quizAnswerDupAgg[0]?.count ?? 0;

  // 2. mockAttempts: verify zero duplicate submitted attempts per (userId, startKey)
  const mockAttemptsCol = db.collection('mockAttempts');
  const [totalMockAttempts, completedMockAttempts, missingResultCompletedMock, duplicateMockStartKeyAgg] =
    await Promise.all([
      mockAttemptsCol.countDocuments({}),
      mockAttemptsCol.countDocuments({ status: 'completed' }),
      mockAttemptsCol.countDocuments({ status: 'completed', $or: [{ result: null }, { result: { $exists: false } }] }),
      mockAttemptsCol
        .aggregate([
          { $match: { startKey: { $type: 'string' } } },
          { $group: { _id: { userId: '$userId', startKey: '$startKey' }, count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $count: 'count' },
        ])
        .toArray(),
    ]);
  const duplicateMockStartKeys = duplicateMockStartKeyAgg[0]?.count ?? 0;

  // 3. userQuestionProgress: verify unique (userId, questionUid) & attempts >= correctCount
  const progressCol = db.collection('userQuestionProgress');
  const [totalProgressDocs, duplicateProgressAgg, inconsistentProgressCounts] = await Promise.all([
    progressCol.countDocuments({}),
    progressCol
      .aggregate([
        { $group: { _id: { userId: '$userId', questionUid: '$questionUid' }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: 'count' },
      ])
      .toArray(),
    progressCol.countDocuments({
      $expr: { $gt: [{ $ifNull: ['$correctCount', 0] }, { $ifNull: ['$attempts', 0] }] },
    }),
  ]);
  const duplicateProgressKeys = duplicateProgressAgg[0]?.count ?? 0;

  // 4. idempotencyRecords: verify 0 stuck pending records post-stage
  const idemCol = db.collection('idempotencyRecords');
  const [totalIdempotencyRecords, pendingIdempotencyRecords] = await Promise.all([
    idemCol.countDocuments({}),
    idemCol.countDocuments({ status: 'pending' }),
  ]);

  const integrityPassed =
    duplicateQuizQuestionSessions === 0 &&
    missingResultCompletedQuiz === 0 &&
    duplicateMockStartKeys === 0 &&
    missingResultCompletedMock === 0 &&
    duplicateProgressKeys === 0 &&
    inconsistentProgressCounts === 0 &&
    pendingIdempotencyRecords === 0;

  return {
    passed: integrityPassed,
    quizSessions: {
      total: totalQuizSessions,
      completed: completedQuizSessions,
      duplicateQuestionUidSessions: duplicateQuizQuestionSessions,
      completedMissingResult: missingResultCompletedQuiz,
    },
    mockAttempts: {
      total: totalMockAttempts,
      completed: completedMockAttempts,
      duplicateStartKeyAttempts: duplicateMockStartKeys,
      completedMissingResult: missingResultCompletedMock,
    },
    userQuestionProgress: {
      totalDocs: totalProgressDocs,
      duplicateUserQuestionKeys: duplicateProgressKeys,
      inconsistentAttemptCounts: inconsistentProgressCounts,
    },
    idempotencyRecords: {
      total: totalIdempotencyRecords,
      stuckPending: pendingIdempotencyRecords,
    },
  };
}

// ============================================================================
// k6 Runner Helper
// ============================================================================
function resolveK6Binary() {
  if (process.env.K6_BIN) return process.env.K6_BIN;
  return 'k6';
}

function runK6Process(envVars) {
  return new Promise((resolve, reject) => {
    const bin = resolveK6Binary();
    const child = spawn(bin, ['run', '--no-color', K6_SCRIPT_PATH], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...envVars },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      stdout += text;
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      stderr += text;
    });
    child.on('error', (err) => {
      if (err.code === 'ENOENT' && process.platform === 'win32' && bin === 'k6') {
        const fallback = spawn('C:\\Program Files\\k6\\k6.exe', ['run', '--no-color', K6_SCRIPT_PATH], {
          cwd: REPO_ROOT,
          env: { ...process.env, ...envVars },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let fbOut = '';
        let fbErr = '';
        fallback.stdout.on('data', (c) => { fbOut += c.toString('utf8'); });
        fallback.stderr.on('data', (c) => { fbErr += c.toString('utf8'); });
        fallback.on('error', reject);
        fallback.on('close', (code) => resolve({ code, stdout: fbOut, stderr: fbErr }));
        return;
      }
      reject(err);
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
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
let closeCacheSub = null;
let stopPasswordWorkers = null;
let tempRunDir = null;
let tempAccountsPath = null;
let exitCode = 0;

function withTimeout(promise, ms = 3000) {
  return Promise.race([
    Promise.resolve(promise).catch(() => {}),
    new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timer.unref();
    }),
  ]);
}

try {
  const runStartedAt = new Date().toISOString();
  const bootStart = performance.now();
  const cpuInfo = os.cpus();
  const logicalCores = cpuInfo.length || 1;
  const hostHardware = {
    platform: `${os.platform()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    cpuModel: cpuInfo[0]?.model || 'unknown',
    logicalCores,
    totalMemoryGb: round2(os.totalmem() / (1024 ** 3)),
  };

  console.log(`[r5-local] Booting isolated MongoMemoryReplSet + local TCP RESP3 Redis stub...`);
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = `meow_r5_local_${Date.now()}`;

  localRedis = createLocalTcpRespRedisServer();
  process.env.REDIS_URL = await localRedis.start();

  // Dynamic imports AFTER env setup
  const { connectMongoDB, disconnectMongoDB } = await import('../config/mongodb.js');
  const { closeRedisClient } = await import('../config/redis.js');
  const { migrate, assertMigrations, migrations } = await import('../migrations/runner.js');
  const { buildNormalizedQuestionFields } = await import('../services/questions/questionNormalizer.js');
  const { trainingQuestionMetadata } = await import('../services/training/domain/questionMetadata.js');
  const { initializePublicCatalogs } = await import('../services/questions/topicCountSnapshot.js');
  const { hashPassword, shutdownPasswordWorkers } = await import('../auth/passwordHash.js');
  const {
    createSession,
    startSessionInvalidationSubscriber,
    closeSessionInvalidationSubscriber,
  } = await import('../auth/sessions.js');
  const {
    startCacheInvalidationSubscriber,
    closeCacheInvalidationSubscriber,
  } = await import('../infrastructure/cacheInvalidation.js');
  const { initPassport } = await import('../auth/passport.js');
  const { startOptionalService, stopOptionalServices } = await import('../infrastructure/optionalServices.js');
  const { listenServer } = await import('../infrastructure/httpListen.js');
  const { createApp } = await import('../app.js');

  disconnectMongo = disconnectMongoDB;
  closeRedis = closeRedisClient;
  closeSessionSub = closeSessionInvalidationSubscriber;
  closeCacheSub = closeCacheInvalidationSubscriber;
  stopPasswordWorkers = shutdownPasswordWorkers;

  const db = await connectMongoDB();
  console.log(`[r5-local] Running migrations (total defined: ${migrations.length})...`);
  const migStart = performance.now();
  await migrate(db);
  await assertMigrations(db);
  const migrateDurationMs = round2(performance.now() - migStart);
  const latestMigrationId = migrations[migrations.length - 1]?.id || 'unknown';
  console.log(`[r5-local] Migrations 001..${latestMigrationId} applied in ${migrateDurationMs} ms.`);

  console.log(`[r5-local] Seeding ${CLI_OPTS.userCount} users, ${CLI_OPTS.questionCount} questions, mock paper, battle season...`);
  const seedResult = await seedIsolatedBenchmarkData(db, {
    userCount: CLI_OPTS.userCount,
    questionCount: CLI_OPTS.questionCount,
    buildNormalizedQuestionFields,
    trainingQuestionMetadata,
    hashPassword,
    createSession,
    initializePublicCatalogs,
  });
  console.log(`[r5-local] Seeded synthetic data in ${seedResult.seedDurationMs} ms.`);

  tempRunDir = await mkdtemp(path.join(os.tmpdir(), 'meow-r5-'));
  tempAccountsPath = path.join(tempRunDir, 'accounts.json');
  await writeFile(tempAccountsPath, JSON.stringify(seedResult.accounts), { encoding: 'utf8', mode: 0o600 });

  // Boot Express server identically to index.js API role (without embedded workers)
  initPassport();
  const { app } = await createApp({
    isReady: () => true,
    isShuttingDown: () => false,
    quizOnlyMode: false,
  });
  await startOptionalService('battle', async () => ({ ok: true }), { enabled: true });
  await startSessionInvalidationSubscriber();
  await startCacheInvalidationSubscriber();

  httpServer = createServer(app);
  await listenServer(httpServer, 0, '127.0.0.1');
  const { port } = httpServer.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[r5-local] Local API listening on ${baseUrl} (boot ${round2(performance.now() - bootStart)} ms).`);

  // Quick readiness probe
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthJson = await healthRes.json();
  if (healthRes.status !== 200 || !healthJson?.ok) {
    throw new Error(`Local API health check failed: HTTP ${healthRes.status} ${JSON.stringify(healthJson)}`);
  }

  await mkdir(RESULTS_DIR, { recursive: true });
  const stageReports = [];

  for (const stage of CLI_OPTS.stages) {
    console.log(`\n[r5-local] >>> Starting ${stage} (duration=${CLI_OPTS.stageDuration}, ramp=${CLI_OPTS.rampDuration}, thinkScale=${CLI_OPTS.thinkTimeScale}) <<<`);
    // Clear only rate-limit counters between independent stages while keeping real rate limiting active within every stage
    localRedis.clearRateLimitKeys();

    const stageArtifactPath = path.resolve(RESULTS_DIR, `results-local-readiness-${stage}.json`);
    const k6RawPath = path.join(os.tmpdir(), `meow-k6-raw-${stage}-${Date.now()}.json`);

    const memBefore = process.memoryUsage();
    let peakRssBytes = memBefore.rss;
    let peakHeapUsedBytes = memBefore.heapUsed;
    let peakMongoPoolWaiting = 0;

    const beforeMetrics = await scrapeMetricsViaHttp(baseUrl, process.env.METRICS_TOKEN);
    const elMonitor = monitorEventLoopDelay({ resolution: 20 });
    elMonitor.enable();
    const cpuStart = process.cpuUsage();
    const wallStartNs = process.hrtime.bigint();

    const sampler = setInterval(async () => {
      const m = process.memoryUsage();
      if (m.rss > peakRssBytes) peakRssBytes = m.rss;
      if (m.heapUsed > peakHeapUsedBytes) peakHeapUsedBytes = m.heapUsed;
      try {
        const snap = await scrapeMetricsViaHttp(baseUrl, process.env.METRICS_TOKEN);
        if (snap && snap.mongoPoolWaiting > peakMongoPoolWaiting) {
          peakMongoPoolWaiting = snap.mongoPoolWaiting;
        }
      } catch {
        // Ignore transient scrape timeout under extreme saturation
      }
    }, 2000);
    sampler.unref();

    const k6Result = await runK6Process({
      BASE_URL: baseUrl,
      K6_ENV: 'local',
      STAGE: stage,
      STAGE_DURATION: CLI_OPTS.stageDuration,
      RAMP_DURATION: CLI_OPTS.rampDuration,
      COOLDOWN_DURATION: CLI_OPTS.cooldownDuration,
      THINK_TIME_SCALE: String(CLI_OPTS.thinkTimeScale),
      STAGE7_TARGET_VUS: String(CLI_OPTS.stage7TargetVus),
      AUTH_JOURNEY_WEIGHT: String(CLI_OPTS.authJourneyWeight),
      LOCAL_BENCH_SPOOF_IP: '1',
      K6_ORIGIN: 'http://localhost:3000',
      EXAM_SLUG: 'ssc-cgl',
      MOCK_TEST_ID: 'cgl-mock-bench-1',
      METRICS_TOKEN: process.env.METRICS_TOKEN,
      TEST_ACCOUNTS_FILE: tempAccountsPath,
      SUMMARY_PATH: k6RawPath,
    });

    clearInterval(sampler);
    const wallElapsedSec = Number(process.hrtime.bigint() - wallStartNs) / 1e9;
    const cpuDelta = process.cpuUsage(cpuStart);
    elMonitor.disable();

    // Small settle delay to let in-flight promises drain before post-stage memory & DB audit
    await new Promise((r) => setTimeout(r, 600));
    const memAfter = process.memoryUsage();
    if (memAfter.rss > peakRssBytes) peakRssBytes = memAfter.rss;
    if (memAfter.heapUsed > peakHeapUsedBytes) peakHeapUsedBytes = memAfter.heapUsed;

    const afterMetrics = await scrapeMetricsViaHttp(baseUrl, process.env.METRICS_TOKEN);
    const dbAudit = await runMongoIntegrityAudit(db);

    let k6Summary = null;
    try {
      k6Summary = JSON.parse(await readFile(k6RawPath, 'utf8'));
    } catch (readErr) {
      console.error(`[r5-local] Failed to parse k6 summary for ${stage}: ${readErr.message}`);
      console.error(k6Result.stderr.slice(-1000));
    } finally {
      await rm(k6RawPath, { force: true }).catch(() => {});
    }

    const totalCpuSec = (cpuDelta.user + cpuDelta.system) / 1e6;
    const processCpuSingleCorePct = wallElapsedSec > 0 ? round2((totalCpuSec / wallElapsedSec) * 100) : 0;
    const processCpuHostPct = wallElapsedSec > 0 ? round2((totalCpuSec / (wallElapsedSec * logicalCores)) * 100) : 0;

    let prometheusDelta = null;
    if (beforeMetrics && afterMetrics) {
      const l1Hits = Math.max(0, (afterMetrics.l1Hits + afterMetrics.l1Stale) - (beforeMetrics.l1Hits + beforeMetrics.l1Stale));
      const redisHits = Math.max(0, (afterMetrics.redisHits + afterMetrics.redisStale) - (beforeMetrics.redisHits + beforeMetrics.redisStale));
      const redisMisses = Math.max(0, afterMetrics.redisMisses - beforeMetrics.redisMisses);
      const sourceMisses = Math.max(0, afterMetrics.sourceMisses - beforeMetrics.sourceMisses);
      const bypasses = Math.max(0, afterMetrics.bypasses - beforeMetrics.bypasses);
      const totalHits = l1Hits + redisHits;
      const totalReads = totalHits + sourceMisses + bypasses;
      const redisLookups = redisHits + redisMisses;
      const mongoCommandsDelta = Math.max(0, afterMetrics.mongoCommandsTotal - beforeMetrics.mongoCommandsTotal);
      const mongoLatCount = Math.max(0, afterMetrics.mongoLatencyCount - beforeMetrics.mongoLatencyCount);
      const mongoLatSumMs = Math.max(0, (afterMetrics.mongoLatencySum - beforeMetrics.mongoLatencySum) * 1000);

      prometheusDelta = {
        tieredCacheHitRatioPct: totalReads > 0 ? round2((totalHits / totalReads) * 100) : 0,
        redisLayerHitRatioPct: redisLookups > 0 ? round2((redisHits / redisLookups) * 100) : 0,
        l1HitsDelta: l1Hits,
        redisHitsDelta: redisHits,
        sourceMissesDelta: sourceMisses,
        redisFallbacksDelta: Math.max(0, afterMetrics.redisFallbacksTotal - beforeMetrics.redisFallbacksTotal),
        mongoCommandsDelta,
        mongoPoolWaitingPeak: Math.max(peakMongoPoolWaiting, afterMetrics.mongoPoolWaiting),
        mongoPoolWaitingAfter: afterMetrics.mongoPoolWaiting,
        mongoCommandLatencyAvgMs: mongoLatCount > 0 ? round2(mongoLatSumMs / mongoLatCount) : 0,
        mongoCommandLatencyP95Ms: estimateHistogramQuantileMs(beforeMetrics.mongoLatencyBuckets, afterMetrics.mongoLatencyBuckets, 0.95),
        mongoCommandLatencyP99Ms: estimateHistogramQuantileMs(beforeMetrics.mongoLatencyBuckets, afterMetrics.mongoLatencyBuckets, 0.99),
      };
    }

    const stageArtifact = {
      schemaVersion: 1,
      stage,
      timestamp: new Date().toISOString(),
      k6ExitCode: k6Result.code,
      k6: k6Summary,
      serverTelemetry: {
        wallElapsedSec: round2(wallElapsedSec),
        cpu: {
          userMs: round2(cpuDelta.user / 1000),
          systemMs: round2(cpuDelta.system / 1000),
          processSingleCorePct: processCpuSingleCorePct,
          processHostPct: processCpuHostPct,
          logicalCores,
        },
        memoryMb: {
          rssBefore: round2(memBefore.rss / (1024 ** 2)),
          rssPeak: round2(peakRssBytes / (1024 ** 2)),
          rssAfter: round2(memAfter.rss / (1024 ** 2)),
          rssDelta: round2((memAfter.rss - memBefore.rss) / (1024 ** 2)),
          heapUsedBefore: round2(memBefore.heapUsed / (1024 ** 2)),
          heapUsedPeak: round2(peakHeapUsedBytes / (1024 ** 2)),
          heapUsedAfter: round2(memAfter.heapUsed / (1024 ** 2)),
          heapUsedDelta: round2((memAfter.heapUsed - memBefore.heapUsed) / (1024 ** 2)),
        },
        eventLoopLagMs: {
          min: round2(elMonitor.min / 1e6),
          mean: round2(elMonitor.mean / 1e6),
          p50: round2(elMonitor.percentile(50) / 1e6),
          p95: round2(elMonitor.percentile(95) / 1e6),
          p99: round2(elMonitor.percentile(99) / 1e6),
          max: round2(elMonitor.max / 1e6),
        },
        prometheus: prometheusDelta,
        localRespStubStats: localRedis.stats(),
      },
      mongoIntegrityAudit: dbAudit,
    };

    await writeFile(stageArtifactPath, `${JSON.stringify(stageArtifact, null, 2)}\n`, 'utf8');
    stageReports.push(stageArtifact);

    const tp = k6Summary?.throughput;
    const lat = k6Summary?.latency;
    console.log(
      `[r5-local] <<< ${stage} finished (k6 exit=${k6Result.code}) | VUs=${k6Summary?.measuredPeakVus ?? 'n/a'} | ` +
        `RPS=${tp?.requestsPerSec ?? 'n/a'} | ReadP95=${lat?.readApi?.p95Ms ?? 'n/a'}ms | WriteP95=${lat?.writeApi?.p95Ms ?? 'n/a'}ms | ` +
        `Fail=${tp?.httpFailedPct ?? 'n/a'}% | EL-p99=${stageArtifact.serverTelemetry.eventLoopLagMs.p99}ms | ` +
        `RSS=${stageArtifact.serverTelemetry.memoryMb.rssPeak}MB | DB-Integrity=${dbAudit.passed ? 'PASS' : 'FAIL'}`,
    );
  }

  // Build aggregate summary JSON
  const aggregatePath = path.resolve(RESULTS_DIR, 'results-local-readiness-summary.json');
  const aggregateSummary = {
    schemaVersion: 1,
    suite: 'meow-production-readiness-local-staged',
    startedAt: runStartedAt,
    completedAt: new Date().toISOString(),
    totalDurationSec: round2((performance.now() - bootStart) / 1000),
    hostHardware,
    environment: {
      mongodbEngine: 'MongoMemoryReplSet (1-node local replica set, WiredTiger)',
      migrationsApplied: migrations.length,
      latestMigrationId,
      redisTransport: 'local-tcp-resp3-stub (in-process TCP speaking RESP3 to real node-redis@6 client)',
      nodeProcessTopology: 'Single Node.js API process sharing host CPU/RAM/loopback sockets with k6 + mongod + RESP3 stub',
      authBcryptWorkers: true,
      questionsNormalizedKeys: true,
      trainingIndexedQuestions: true,
      mongoMaxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE),
      seeded: seedResult.seeded,
      stageConfig: {
        stages: CLI_OPTS.stages,
        stageDuration: CLI_OPTS.stageDuration,
        rampDuration: CLI_OPTS.rampDuration,
        cooldownDuration: CLI_OPTS.cooldownDuration,
        thinkTimeScale: Number(CLI_OPTS.thinkTimeScale),
        stage7TargetVus: CLI_OPTS.stage7TargetVus,
        authJourneyWeight: CLI_OPTS.authJourneyWeight,
      },
    },
    stages: stageReports.map((r) => ({
      stage: r.stage,
      artifactFile: `load-tests/k6/results-local-readiness-${r.stage}.json`,
      k6ExitCode: r.k6ExitCode,
      allThresholdsPassed: r.k6?.allThresholdsPassed ?? false,
      targetPeakVus: r.k6?.targetPeakVus ?? null,
      measuredPeakVus: r.k6?.measuredPeakVus ?? null,
      totalRequests: r.k6?.throughput?.totalRequests ?? 0,
      requestsPerSec: r.k6?.throughput?.requestsPerSec ?? 0,
      httpFailedPct: r.k6?.throughput?.httpFailedPct ?? null,
      httpFailedCount: r.k6?.throughput?.httpFailedCount ?? null,
      checksPassPct: r.k6?.throughput?.checksPassPct ?? null,
      readP50Ms: r.k6?.latency?.readApi?.p50Ms ?? null,
      readP95Ms: r.k6?.latency?.readApi?.p95Ms ?? null,
      readP99Ms: r.k6?.latency?.readApi?.p99Ms ?? null,
      writeP50Ms: r.k6?.latency?.writeApi?.p50Ms ?? null,
      writeP95Ms: r.k6?.latency?.writeApi?.p95Ms ?? null,
      writeP99Ms: r.k6?.latency?.writeApi?.p99Ms ?? null,
      quizJourneyFailures: r.k6?.integrity?.quizJourneyFailures ?? null,
      duplicateSubmissions: r.k6?.integrity?.duplicateSubmissions ?? null,
      answerKeyLeaks: r.k6?.integrity?.answerKeyLeaks ?? null,
      replaysVerified: r.k6?.integrity?.replaysVerified ?? null,
      errors: r.k6?.errors ?? null,
      journeys: r.k6?.journeys ?? null,
      cpuSingleCorePct: r.serverTelemetry.cpu.processSingleCorePct,
      cpuHostPct: r.serverTelemetry.cpu.processHostPct,
      memoryMb: r.serverTelemetry.memoryMb,
      eventLoopLagMs: r.serverTelemetry.eventLoopLagMs,
      prometheus: r.serverTelemetry.prometheus,
      mongoIntegrityPassed: r.mongoIntegrityAudit.passed,
      mongoIntegrityAudit: r.mongoIntegrityAudit,
    })),
    caveats: [
      'Local single-host Windows benchmark: k6 load generator, single Node.js API process, local TCP RESP3 stub, and MongoMemoryReplSet (mongod) all share the same CPU cores, RAM, and Windows loopback ephemeral TCP port space.',
      'Local loopback omits real WAN/TLS latency to MongoDB Atlas and Aiven Valkey, and uses an in-process RESP3 stub rather than a real networked Valkey/Redis server.',
      'LOCAL_BENCH_SPOOF_IP=1 assigns per-VU X-Forwarded-For (10.0.x.y) over Express trust proxy with 150 synthetic users so real express-rate-limit middleware stays active without all VUs colliding on 127.0.0.1.',
      'Rate-limit keys in the local RESP3 stub were reset between independent stage runs while remaining strictly enforced inside each stage.',
    ],
  };

  await writeFile(aggregatePath, `${JSON.stringify(aggregateSummary, null, 2)}\n`, 'utf8');
  console.log(`\n[r5-local] Aggregate summary written -> ${aggregatePath}`);

  console.table(
    aggregateSummary.stages.map((s) => ({
      stage: s.stage,
      vus: s.measuredPeakVus,
      rps: s.requestsPerSec,
      readP95: s.readP95Ms,
      writeP95: s.writeP95Ms,
      failPct: s.httpFailedPct,
      quizFail: s.quizJourneyFailures,
      dups: s.duplicateSubmissions,
      leaks: s.answerKeyLeaks,
      elP99: s.eventLoopLagMs.p99,
      rssPeakMB: s.memoryMb.rssPeak,
      dbOk: s.mongoIntegrityPassed,
      pass: s.allThresholdsPassed,
    })),
  );

  await stopOptionalServices();
} catch (err) {
  exitCode = 1;
  console.error('[r5-local] Benchmark harness error:', err);
} finally {
  if (tempRunDir) {
    await rm(tempRunDir, { recursive: true, force: true }).catch(() => {});
  } else if (tempAccountsPath) {
    await rm(tempAccountsPath, { force: true }).catch(() => {});
  }
  if (httpServer) {
    httpServer.closeIdleConnections?.();
    httpServer.closeAllConnections?.();
    await withTimeout(new Promise((resolve) => httpServer.close(() => resolve())), 3000);
  }
  await withTimeout(stopPasswordWorkers?.(), 3000);
  await withTimeout(closeCacheSub?.(), 3000);
  await withTimeout(closeSessionSub?.(), 3000);
  await withTimeout(closeRedis?.(), 3000);
  await withTimeout(localRedis?.stop(), 3000);
  await withTimeout(disconnectMongo?.(), 5000);
  await withTimeout(mongo?.stop(), 8000);
  process.exit(exitCode);
}
