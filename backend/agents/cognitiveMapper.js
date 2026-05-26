// backend/agents/cognitiveMapper.js
// QuizGuru — Cognitive Failure Mapper Agent
// Classifies every wrong answer across 5 failure dimensions using Azure OpenAI

import { chatJSON } from "../ai/azureClient.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const DIMENSIONS = {
  CONCEPTUAL_GAP: "CONCEPTUAL_GAP", // Doesn't know the rule
  APPLICATION_ERROR: "APPLICATION_ERROR", // Knows rule, applied it wrong
  TRAP_CAUGHT: "TRAP_CAUGHT", // Fooled by SSC's deliberate distractor
  SPEED_PANIC: "SPEED_PANIC", // Changed answer last second → wrong
  BLIND_SPOT: "BLIND_SPOT", // Consistently avoids / guesses the concept
};

const DEFAULT_MODEL = process.env.AZURE_OPENAI_MODEL || "o4-mini";

// ─── Rule-based pre-filter (no LLM cost for obvious cases) ────────────────────

function ruleBasedClassify({ timeSpent, changedAnswer, correctAnswer, userAnswer, skipped }) {
  if (skipped) {
    return { dimension: DIMENSIONS.BLIND_SPOT, confidence: 0.9, source: "rule" };
  }
  if (timeSpent < 6) {
    return { dimension: DIMENSIONS.BLIND_SPOT, confidence: 0.85, source: "rule" };
  }
  if (changedAnswer && userAnswer !== correctAnswer) {
    return { dimension: DIMENSIONS.SPEED_PANIC, confidence: 0.88, source: "rule" };
  }
  return null; // needs LLM
}

// ─── LLM-based classifier for ambiguous cases ─────────────────────────────────

async function llmClassify({ question, options, userAnswer, correctAnswer, solution, concept, topic }) {
  const optionsStr = Array.isArray(options)
    ? options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")
    : JSON.stringify(options);

  const prompt = `You are an SSC CGL exam psychologist. A student answered a question WRONG.
Classify the failure as EXACTLY ONE of these three types:

CONCEPTUAL_GAP     — Student doesn't know the underlying rule or concept at all.
APPLICATION_ERROR  — Student knows the concept but made a calculation, logic, or step error applying it.
TRAP_CAUGHT        — Student knew something but SSC's deliberately misleading distractor fooled them.

---
Topic: ${topic}
Concept tested: ${concept}
Question: ${question}
Options:
${optionsStr}
Student chose: ${userAnswer}
Correct answer: ${correctAnswer}
Official solution: ${solution}
---

Reply with ONLY valid JSON. No extra text, no markdown, no explanation outside the JSON.
Format: {"dimension":"<ONE_OF_THREE>","reason":"<one sentence why>","confidence":<0.0_to_1.0>}`;

  const parsed = await chatJSON(prompt, DEFAULT_MODEL, "You are a precise JSON-only response bot.");
  return { ...parsed, source: "llm" };
}

// ─── Main export: tag a single wrong answer ──────────────────────────────────

/**
 * Tags a wrong answer with its failure dimension.
 *
 * @param {Object} params
 * @param {string} params.questionId
 * @param {string} params.topic         - e.g. "Mirror Images"
 * @param {string} params.concept       - e.g. "Clock Face Rotation"
 * @param {string} params.question      - The question text
 * @param {Array}  params.options        - Answer options array
 * @param {string} params.userAnswer
 * @param {string} params.correctAnswer
 * @param {string} params.solution       - Official solution text from Cosmos
 * @param {number} params.timeSpent      - Seconds taken
 * @param {boolean} params.changedAnswer  - Did user change their answer?
 * @param {boolean} params.skipped
 * @returns {Object} { dimension, reason, confidence, source, taggedAt }
 */
export async function tagFailure(params) {
  // 1. Try cheap rule-based first
  const rulesResult = ruleBasedClassify(params);
  if (rulesResult) {
    return {
      ...rulesResult,
      reason: getRuleReason(rulesResult.dimension, params),
      taggedAt: new Date().toISOString(),
    };
  }

  // 2. Fall back to LLM for nuanced classification
  const llmResult = await llmClassify(params);
  return {
    ...llmResult,
    taggedAt: new Date().toISOString(),
  };
}

function getRuleReason(dimension, { timeSpent }) {
  if (dimension === DIMENSIONS.BLIND_SPOT)
    return timeSpent < 6
      ? `Answered in ${timeSpent}s — too fast to have engaged with the question.`
      : "Question was skipped entirely.";
  if (dimension === DIMENSIONS.SPEED_PANIC)
    return "Changed answer in the last moment; original might have been correct.";
  return "";
}

// ─── Batch processor: tag multiple wrong answers (post-quiz) ─────────────────

/**
 * Tags an array of wrong answers in parallel (with concurrency cap).
 * Use after a quiz completes.
 */
export async function tagFailureBatch(wrongAnswers, concurrency = 3) {
  const results = [];
  for (let i = 0; i < wrongAnswers.length; i += concurrency) {
    const batch = wrongAnswers.slice(i, i + concurrency);
    const tagged = await Promise.all(batch.map((q) => tagFailure(q)));
    results.push(
      ...tagged.map((tag, idx) => ({
        questionId: batch[idx].questionId,
        topic: batch[idx].topic,
        concept: batch[idx].concept,
        ...tag,
      }))
    );
  }
  return results;
}

// ─── Failure Map updater: merge tags into user's Cosmos profile ───────────────

/**
 * Updates the user's failureMap in Cosmos DB.
 * Call this after tagFailureBatch returns.
 *
 * @param {Object} existingFailureMap  - Current map from user profile doc
 * @param {Array}  taggedResults       - Output of tagFailureBatch
 * @returns {Object} Updated failureMap
 */
export function updateFailureMap(existingFailureMap, taggedResults) {
  const map = { ...existingFailureMap };

  for (const tag of taggedResults) {
    const key = `${tag.topic}::${tag.concept}`;
    if (!map[key]) {
      map[key] = {
        CONCEPTUAL_GAP: 0,
        APPLICATION_ERROR: 0,
        TRAP_CAUGHT: 0,
        SPEED_PANIC: 0,
        BLIND_SPOT: 0,
        lastSeen: null,
        totalWrong: 0,
      };
    }
    map[key][tag.dimension] = (map[key][tag.dimension] || 0) + 1;
    map[key].totalWrong = (map[key].totalWrong || 0) + 1;
    map[key].lastSeen = tag.taggedAt;
  }

  return map;
}

// ─── Dominant dimension resolver ─────────────────────────────────────────────

/**
 * Returns the dominant failure dimension for a given concept key.
 * Used by Drill Prescriber to decide drill type.
 */
export function getDominantDimension(failureMapEntry) {
  if (!failureMapEntry) return null;
  const dims = [
    DIMENSIONS.CONCEPTUAL_GAP,
    DIMENSIONS.APPLICATION_ERROR,
    DIMENSIONS.TRAP_CAUGHT,
    DIMENSIONS.SPEED_PANIC,
    DIMENSIONS.BLIND_SPOT,
  ];
  return dims.reduce(
    (max, d) => ((failureMapEntry[d] || 0) > (failureMapEntry[max] || 0) ? d : max),
    dims[0]
  );
}

// ─── Top weak concepts extractor ─────────────────────────────────────────────

/**
 * Returns the top N most-failed concepts from the full failure map.
 * Used by Score Predictor and Daily Planner.
 */
export function getTopWeakConcepts(failureMap, n = 5) {
  return Object.entries(failureMap)
    .map(([key, data]) => {
      const [topic, concept] = key.split("::");
      return {
        key,
        topic,
        concept,
        totalWrong: data.totalWrong || 0,
        dominantDimension: getDominantDimension(data),
        lastSeen: data.lastSeen,
        breakdown: {
          CONCEPTUAL_GAP: data.CONCEPTUAL_GAP || 0,
          APPLICATION_ERROR: data.APPLICATION_ERROR || 0,
          TRAP_CAUGHT: data.TRAP_CAUGHT || 0,
          SPEED_PANIC: data.SPEED_PANIC || 0,
          BLIND_SPOT: data.BLIND_SPOT || 0,
        },
      };
    })
    .sort((a, b) => b.totalWrong - a.totalWrong)
    .slice(0, n);
}
