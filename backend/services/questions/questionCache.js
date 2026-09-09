import { LRUCache } from "lru-cache";

// Production reads go directly to Mongo until a shared cache is explicitly introduced.
// This also covers writes performed by other ingestion processes.
class QuestionCache extends LRUCache {
  get(key, options) { return process.env.NODE_ENV === 'production' ? undefined : super.get(key, options); }
  set(key, value, options) { return process.env.NODE_ENV === 'production' ? this : super.set(key, value, options); }
}

export const QUESTIONS_QUERY_CACHE_TTL_MS = 60 * 1000;

export const questionsQueryCache = new QuestionCache({
  max: 500,
  ttl: QUESTIONS_QUERY_CACHE_TTL_MS,
});

export const questionCountsCache = new QuestionCache({
  max: 500,
  ttl: QUESTIONS_QUERY_CACHE_TTL_MS,
});

export function buildQuestionsCacheKey(parameters, offset, limit) {
  return JSON.stringify({
    params: parameters.map((entry) => [entry.name, entry.value]),
    offset,
    limit,
  });
}
