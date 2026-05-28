// QuizGuru — Azure OpenAI Pattern Analyzer
// Analyzes user's attempt history to determine optimal question selection strategy

import { AzureOpenAI } from "openai";

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT, // e.g. https://your-resource.openai.azure.com
  apiKey: process.env.AZURE_OPENAI_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT, // your gpt-oss-120B deployment name
});

// ─── Subject → topic mappings (SSC CGL Tier-2 syllabus) ──────────────────────

export const SUBJECT_TOPICS = {
  Reasoning: [
    "Analogy",
    "Coding-Decoding",
    "Mirror Images",
    "Water Images",
    "Classification",
    "Venn Diagrams",
    "Mathematical Operations",
    "Series",
    "Blood Relations",
    "Direction Sense",
    "Embedded Figures",
    "Paper Folding",
    "Syllogism",
    "Statement Conclusions",
  ],
  Mathematics: [
    "Number System",
    "Percentage",
    "Ratio Proportion",
    "Simple Interest",
    "Compound Interest",
    "Profit Loss",
    "Discount",
    "Time Speed Distance",
    "Time Work",
    "Algebra",
    "Geometry",
    "Trigonometry",
    "Mensuration 2D",
    "Mensuration 3D",
    "Statistics",
  ],
  English: [
    "Synonyms",
    "Antonyms",
    "One Word Substitution",
    "Idioms Phrases",
    "Error Spotting",
    "Sentence Improvement",
    "Active & Passive Voice",
    "Direct Indirect",
    "Para Jumbles",
    "Cloze Test",
    "Reading Comprehension",
    "Fill in the Blanks",
  ],
  "General Awareness": [
    "History",
    "Geography",
    "Polity",
    "Economy",
    "Science",
    "Current Affairs",
    "Static GK",
    "Sports",
  ],
};

// ─── Difficulty weights for adaptive selection ────────────────────────────────

const DIFFICULTY_STRATEGY = {
  // accuracy < 40%  → start easy, build confidence
  struggling: { easy: 0.5, medium: 0.4, hard: 0.1 },
  // accuracy 40-70% → mixed, push difficulty
  developing: { easy: 0.2, medium: 0.5, hard: 0.3 },
  // accuracy > 70%  → challenge mode
  proficient: { easy: 0.1, medium: 0.3, hard: 0.6 },
};

// ─── Build topic performance summary for LLM context ─────────────────────────

function buildPerformanceSummary(attemptHistory, failureMap) {
  const topicStats = {};

  for (const attempt of attemptHistory) {
    const { topic, subject, isCorrect, timeSpent } = attempt;
    if (!topicStats[topic]) {
      topicStats[topic] = { subject, correct: 0, total: 0, totalTime: 0 };
    }
    topicStats[topic].total++;
    if (isCorrect) topicStats[topic].correct++;
    topicStats[topic].totalTime += timeSpent || 0;
  }

  return Object.entries(topicStats).map(([topic, s]) => ({
    topic,
    subject: s.subject,
    accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    attempted: s.total,
    avgTime: s.total > 0 ? Math.round(s.totalTime / s.total) : 0,
    dominantFailure: failureMap?.[topic]
      ? Object.entries(failureMap[topic])
          .filter(([k]) =>
            [
              "CONCEPTUAL_GAP",
              "APPLICATION_ERROR",
              "TRAP_CAUGHT",
              "SPEED_PANIC",
              "BLIND_SPOT",
            ].includes(k)
          )
          .sort((a, b) => b[1] - a[1])[0]?.[0]
      : null,
  }));
}

// ─── Core Azure OpenAI pattern analysis ──────────────────────────────────────

/**
 * Calls Azure OpenAI to analyze the student's pattern and return
 * a structured quiz configuration: topic allocations, difficulty mix,
 * and a motivational insight message.
 *
 * @param {Object} params
 * @param {Array}  params.attemptHistory   - Last 100–200 question attempts
 * @param {Object} params.failureMap       - From Cognitive Failure Mapper
 * @param {Object} params.masteryMap       - Mastery levels per topic
 * @param {Array}  params.subjects         - Subjects to include
 * @param {number} params.questionCount    - Total questions requested (default 20)
 * @returns {Object} Quiz configuration with topic allocations
 */
export async function analyzePatternAndConfigure({
  attemptHistory = [],
  failureMap = {},
  masteryMap = {},
  subjects = ["Reasoning", "Mathematics", "English", "General Awareness"],
  questionCount = 20,
}) {
  // Build performance summary (cheap, no LLM)
  const perfSummary = buildPerformanceSummary(attemptHistory, failureMap);

  // Topics with zero attempts (never studied)
  const allTopics = subjects.flatMap(s => SUBJECT_TOPICS[s] || []);
  const attemptedTopics = new Set(perfSummary.map(p => p.topic));
  const neverAttempted = allTopics.filter(t => !attemptedTopics.has(t));

  // If no history yet → return default balanced config (no LLM needed)
  if (attemptHistory.length < 5) {
    return buildDefaultConfig(subjects, questionCount, neverAttempted);
  }

  // ── Azure OpenAI call ──────────────────────────────────────────────────────
  const systemPrompt = `You are an SSC CGL Tier-2 exam preparation strategist.
You analyze a student's performance data and configure an optimal adaptive quiz.
Your goal: maximize exam score improvement in the shortest time.
Always respond with ONLY valid JSON — no markdown, no explanation, no extra text.`;

  const userPrompt = `Student performance data:
${JSON.stringify(perfSummary, null, 2)}

Mastery levels (0=unknown, 5=exam-ready):
${JSON.stringify(masteryMap, null, 2)}

Never attempted topics: ${neverAttempted.join(", ")}
Subjects requested: ${subjects.join(", ")}
Total questions needed: ${questionCount}

Analyze the pattern and return a JSON quiz configuration:
{
  "topicAllocations": [
    {
      "topic": "string",
      "subject": "string", 
      "questionCount": number,
      "difficultyMix": { "easy": number, "medium": number, "hard": number },
      "reason": "one sentence why this topic was chosen"
    }
  ],
  "quizStrategy": "struggling" | "developing" | "proficient",
  "overallInsight": "2 sentences — honest assessment of current pattern and what this quiz targets",
  "estimatedDuration": number,
  "focusArea": "string — the single most impactful area to fix today"
}

Rules:
- Sum of all questionCount values must equal exactly ${questionCount}
- Each difficultyMix must sum to exactly the questionCount for that topic
- Prioritize topics with accuracy < 60% and failureMap entries
- Include at least one never-attempted topic if subjects allow
- Max 6 unique topics for a ${questionCount}-question quiz
- Topics with CONCEPTUAL_GAP dominant failure → more easy questions first`;

  try {
    const response = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const raw = response.choices[0].message.content
      .trim()
      .replace(/```json|```/g, "")
      .trim();

    const config = JSON.parse(raw);

    // Validate and sanitize
    return sanitizeConfig(config, questionCount, subjects);
  } catch (err) {
    console.error("[patternAnalyzer] Azure OpenAI error:", err.message);
    // Graceful fallback — rule-based config
    return buildRuleBasedConfig(
      perfSummary,
      subjects,
      questionCount,
      neverAttempted,
      failureMap
    );
  }
}

// ─── Fallback: rule-based config (no LLM) ────────────────────────────────────

function buildRuleBasedConfig(
  perfSummary,
  subjects,
  questionCount,
  neverAttempted,
  failureMap
) {
  // Sort topics by urgency: low accuracy + high failure count
  const weakTopics = perfSummary
    .filter(p => subjects.includes(p.subject))
    .sort((a, b) => {
      const scoreA = 100 - a.accuracy + (a.attempted > 0 ? 10 : 0);
      const scoreB = 100 - b.accuracy + (b.attempted > 0 ? 10 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 4);

  // Add 1–2 never-attempted topics
  const exploreTopics = neverAttempted
    .filter(t => subjects.some(s => SUBJECT_TOPICS[s]?.includes(t)))
    .slice(0, 2);

  const selectedTopics = [...weakTopics.map(t => t.topic), ...exploreTopics].slice(
    0,
    6
  );
  const perTopic = Math.floor(questionCount / selectedTopics.length);
  const remainder = questionCount - perTopic * selectedTopics.length;

  const topicAllocations = selectedTopics.map((topic, i) => {
    const perf = perfSummary.find(p => p.topic === topic);
    const acc = perf?.accuracy ?? 0;
    const strategy =
      acc < 40
        ? DIFFICULTY_STRATEGY.struggling
        : acc < 70
          ? DIFFICULTY_STRATEGY.developing
          : DIFFICULTY_STRATEGY.proficient;
    const count = perTopic + (i === 0 ? remainder : 0);
    const subject =
      Object.entries(SUBJECT_TOPICS).find(([, topics]) => topics.includes(topic))
        ?.[0] || subjects[0];

    return {
      topic,
      subject,
      questionCount: count,
      difficultyMix: {
        easy: Math.round(count * strategy.easy),
        medium: Math.round(count * strategy.medium),
        hard:
          count -
          Math.round(count * strategy.easy) -
          Math.round(count * strategy.medium),
      },
      reason: perf
        ? `Accuracy ${acc}% — needs targeted practice`
        : "Never attempted — first exposure",
    };
  });

  return {
    topicAllocations,
    quizStrategy: "developing",
    overallInsight:
      "Pattern analysis used rule-based fallback. Complete more quizzes for AI-powered insights.",
    estimatedDuration: questionCount * 45,
    focusArea: weakTopics[0]?.topic || selectedTopics[0],
    source: "rule-based",
  };
}

function buildDefaultConfig(subjects, questionCount, neverAttempted) {
  const perSubject = Math.floor(questionCount / subjects.length);
  const topicAllocations = subjects.map((subject, i) => {
    const topic = SUBJECT_TOPICS[subject]?.[0] || subject;
    const count =
      perSubject +
      (i === 0 ? questionCount - perSubject * subjects.length : 0);
    return {
      topic,
      subject,
      questionCount: count,
      difficultyMix: {
        easy: Math.ceil(count * 0.4),
        medium: Math.ceil(count * 0.4),
        hard: count - Math.ceil(count * 0.4) * 2,
      },
      reason: "Starting fresh — balanced introduction",
    };
  });
  return {
    topicAllocations,
    quizStrategy: "struggling",
    overallInsight:
      "Welcome! Your first adaptive quiz is balanced across all subjects. Performance data will refine future quizzes.",
    estimatedDuration: questionCount * 50,
    focusArea: subjects[0],
    source: "default",
  };
}

function sanitizeConfig(config, questionCount, subjects) {
  // Ensure total question count is exactly right
  const total = config.topicAllocations.reduce((s, t) => s + t.questionCount, 0);
  if (total !== questionCount && config.topicAllocations.length > 0) {
    config.topicAllocations[0].questionCount += questionCount - total;
  }
  config.source = "azure-openai";
  return config;
}
