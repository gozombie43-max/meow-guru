// ============================================================================
// Meow k6 Data, Filter, Payload & Integrity Helpers
// ============================================================================
// Zero k6/* imports — safe in both k6 runtime and Node.js unit tests.

export const DEFAULT_SUBJECT = 'mathematics';
export const DEFAULT_EXAM_MODE = 'ssc';
export const DEFAULT_PROGRESS_TOPIC = 'percentages';

export const PROGRESS_SUBJECT_ALLOWLIST = [
  'mathematics',
  'reasoning',
  'english',
  'general-awareness',
];

export const PROGRESS_TOPIC_POOL = [
  'percentages',
  'ratio-and-proportion',
  'profit-and-loss',
  'algebra',
  'geometry',
];

export const QUIZ_MODE_WEIGHTS = [
  { mode: 'practice', weight: 40 },
  { mode: 'topic', weight: 30 },
  { mode: 'speed', weight: 15 },
  { mode: 'mock', weight: 15 },
];

const TOTAL_MODE_WEIGHT = QUIZ_MODE_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);

const FORBIDDEN_ANSWER_KEY_FIELDS = new Set([
  'correctAnswer',
  'correctLetter',
  'correctIndex',
  'correctOption',
  'correct_answer',
  'correct_letter',
  'solution',
  'solutionImage',
  'solutionText',
  'explanation',
  'answerKey',
  'answer_key',
]);

const FORBIDDEN_FIELD_PATTERNS = [
  /^correct([A-Z_].*|$)/i,
  /^solution([A-Z_].*|$)/i,
  /^explanation([A-Z_].*|$)/i,
  /^answer(_?key)?$/i,
];

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export function safeJson(res) {
  try {
    return typeof res?.json === 'function' ? res.json() : JSON.parse(res?.body || 'null');
  } catch {
    return null;
  }
}

export function buildQueryString(params = {}) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value).trim())}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export function getQuestionFilterParams(config = {}, overrides = {}) {
  const subject = String(overrides.subject ?? config.subject ?? DEFAULT_SUBJECT).trim() || DEFAULT_SUBJECT;
  const examMode = String(overrides.examMode ?? config.examMode ?? DEFAULT_EXAM_MODE).trim() || DEFAULT_EXAM_MODE;
  const topic = String(overrides.topic ?? config.topic ?? '').trim();

  const params = { subject, examMode };
  // Include topic only when explicitly configured/overridden because backend
  // questionQueryIdentity/quizSessionV1Service discard subject when topic is set.
  if (topic) {
    params.topic = topic;
  }
  return params;
}

export function getMetaFilterParams(config = {}, overrides = {}) {
  const topic = String(overrides.topic ?? config.topic ?? '').trim();
  const subject = String(overrides.subject ?? config.subject ?? '').trim();
  const examMode = String(overrides.examMode ?? config.examMode ?? DEFAULT_EXAM_MODE).trim() || DEFAULT_EXAM_MODE;

  const params = { examMode };
  if (topic) {
    params.topic = topic;
  }
  // Guarantee topic OR subject is always non-empty (prevents 400 on /api/questions/meta & /counts).
  if (subject || !topic) {
    params.subject = subject || DEFAULT_SUBJECT;
  }
  return params;
}

export function getProgressSubject(config = {}) {
  const candidate = String(config?.subject || '').trim().toLowerCase();
  if (PROGRESS_SUBJECT_ALLOWLIST.includes(candidate)) {
    return candidate;
  }
  return DEFAULT_SUBJECT;
}

export function getProgressTopic(config = {}, index = 0) {
  const raw = String(config?.topic || '').trim();
  if (raw && /^[^.$]{1,120}$/.test(raw)) {
    return raw;
  }
  const idx = Math.abs(Math.trunc(Number(index) || 0)) % PROGRESS_TOPIC_POOL.length;
  return PROGRESS_TOPIC_POOL[idx] || DEFAULT_PROGRESS_TOPIC;
}

export function makeIdempotencyKey(prefix = 'k6', context = {}) {
  const cleanPrefix =
    String(prefix || 'k6')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 24) || 'k6';
  const vu = String(context.vu ?? 0).replace(/[^a-zA-Z0-9_-]/g, '');
  const iter = String(context.iter ?? 0).replace(/[^a-zA-Z0-9_-]/g, '');
  const ts = Date.now().toString(36);
  const randA = Math.floor(Math.random() * 0xffffffff)
    .toString(36)
    .padStart(7, '0');
  const randB = Math.floor(Math.random() * 0xffffffff)
    .toString(36)
    .padStart(7, '0');

  let key = `${cleanPrefix}_${vu}_${iter}_${ts}_${randA}${randB}`;
  if (key.length < 24) {
    key = key.padEnd(24, '0');
  }
  if (key.length > 96) {
    key = key.slice(0, 96);
  }
  return key;
}

export function pickWeightedQuizMode(forcedMode = '') {
  const forced = String(forcedMode || '').trim().toLowerCase();
  if (forced) {
    if (!QUIZ_MODE_WEIGHTS.some((entry) => entry.mode === forced)) {
      throw new Error(`Invalid forced quiz mode "${forced}"`);
    }
    return forced;
  }

  let cursor = Math.random() * TOTAL_MODE_WEIGHT;
  for (const item of QUIZ_MODE_WEIGHTS) {
    cursor -= item.weight;
    if (cursor <= 0) return item.mode;
  }
  return 'practice';
}

export function isForbiddenAnswerKeyField(key) {
  if (typeof key !== 'string') return false;
  if (FORBIDDEN_ANSWER_KEY_FIELDS.has(key)) return true;
  return FORBIDDEN_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

export function countAnswerKeyLeaks(questions) {
  if (!Array.isArray(questions)) return 0;
  let leaks = 0;

  for (const q of questions) {
    if (!q || typeof q !== 'object') continue;
    for (const key of Object.keys(q)) {
      if (isForbiddenAnswerKeyField(key) && q[key] !== undefined && q[key] !== null) {
        leaks++;
      }
    }
    if (q.translations && typeof q.translations === 'object' && !Array.isArray(q.translations)) {
      for (const langObj of Object.values(q.translations)) {
        if (!langObj || typeof langObj !== 'object' || Array.isArray(langObj)) continue;
        for (const key of Object.keys(langObj)) {
          if (isForbiddenAnswerKeyField(key) && langObj[key] !== undefined && langObj[key] !== null) {
            leaks++;
          }
        }
      }
    }
  }
  return leaks;
}

export function trackUniqueQuestions(questions, seenSet) {
  if (!Array.isArray(questions) || !(seenSet instanceof Set)) return 0;
  let duplicates = 0;
  for (const q of questions) {
    if (!q || typeof q !== 'object') continue;
    const uid = String(q.questionUid || q.id || q.sessionAnchor || '').trim();
    if (!uid) continue;
    if (seenSet.has(uid)) {
      duplicates++;
    } else {
      seenSet.add(uid);
    }
  }
  return duplicates;
}

export function pickOptionIndex(question) {
  if (Array.isArray(question?.options) && question.options.length > 0) {
    return Math.floor(Math.random() * question.options.length);
  }
  return 0;
}

export function classifyHttpResponse(res, allowedBusinessStatuses = []) {
  const status = Number(res?.status ?? 0);
  if (status >= 200 && status < 300) {
    return {
      status,
      category: 'ok',
      errorClass: 'none',
      isOk: true,
      isBusinessError: false,
      isInfraError: false,
      isAuthError: false,
      isRateLimited: false,
      isUnhandled5xx: false,
    };
  }

  if (Array.isArray(allowedBusinessStatuses) && allowedBusinessStatuses.includes(status)) {
    return {
      status,
      category: 'business',
      errorClass: 'business',
      isOk: false,
      isBusinessError: true,
      isInfraError: false,
      isAuthError: false,
      isRateLimited: false,
      isUnhandled5xx: false,
    };
  }

  if (status === 401 || status === 403) {
    return {
      status,
      category: 'auth',
      errorClass: 'infra',
      isOk: false,
      isBusinessError: false,
      isInfraError: true,
      isAuthError: true,
      isRateLimited: false,
      isUnhandled5xx: false,
    };
  }

  if (status === 429) {
    return {
      status,
      category: 'rate_limit',
      errorClass: 'infra',
      isOk: false,
      isBusinessError: false,
      isInfraError: true,
      isAuthError: false,
      isRateLimited: true,
      isUnhandled5xx: false,
    };
  }

  if (status === 0 || status >= 500) {
    return {
      status,
      category: 'infra',
      errorClass: 'infra',
      isOk: false,
      isBusinessError: false,
      isInfraError: true,
      isAuthError: false,
      isRateLimited: false,
      isUnhandled5xx: status >= 500,
    };
  }

  return {
    status,
    category: 'business',
    errorClass: 'business',
    isOk: false,
    isBusinessError: true,
    isInfraError: false,
    isAuthError: false,
    isRateLimited: false,
    isUnhandled5xx: false,
  };
}
