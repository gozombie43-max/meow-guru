import { LRUCache } from "lru-cache";

export const QUESTIONS_QUERY_CACHE_TTL_MS = 60 * 1000;

export const questionsQueryCache = new LRUCache({
  max: 500,
  ttl: QUESTIONS_QUERY_CACHE_TTL_MS,
});

export const questionCountsCache = new LRUCache({
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
