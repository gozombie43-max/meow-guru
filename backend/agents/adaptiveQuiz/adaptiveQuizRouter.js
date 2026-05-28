// backend/agents/adaptiveQuiz/adaptiveQuizRouter.js
// QuizGuru — Adaptive Quiz API Routes

import express from "express";
import { analyzePatternAndConfigure, SUBJECT_TOPICS } from "./patternAnalyzer.js";
import { buildAdaptiveQuiz, saveQuizAttempts } from "./quizBuilder.js";
import { CosmosClient } from "@azure/cosmos";

const router = express.Router();

const cosmosClient = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

async function getUserProfile(userId) {
  try {
    const { resource } = await cosmosClient
      .database(process.env.COSMOS_DB_NAME || "quizDB")
      .container("userProfiles")
      .item(userId, userId)
      .read();
    return resource;
  } catch {
    return null;
  }
}

async function getUserQuestionIds(userId) {
  const DB = process.env.COSMOS_DB_NAME || "quizDB";
  const CONT = process.env.COSMOS_CONTAINER || "questions";
  try {
    const { resources } = await cosmosClient
      .database(DB)
      .container(CONT)
      .items.query({
        query: `SELECT c.id FROM c WHERE c.createdBy = @user OR c.uploader = @user OR c.author = @user`,
        parameters: [{ name: "@user", value: userId }],
      })
      .fetchAll();
    return (resources || []).map(r => r.id).filter(Boolean);
  } catch (err) {
    console.warn("[adaptiveQuiz] failed to fetch user's question ids:", err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/adaptive-quiz/generate
// Main endpoint — analyzes pattern with Azure OpenAI, fetches questions from Cosmos
// Body: { userId, subjects?, questionCount?, mode? }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/generate", async (req, res) => {
  try {
    const {
      userId,
      subjects = ["Reasoning", "Mathematics", "English", "General Awareness"],
      questionCount = 20,
      mode = "adaptive",          // "adaptive" | "weak-only" | "revision" | "explore"
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // 1. Load user profile from Cosmos
    const profile = await getUserProfile(userId);

    const attemptHistory   = profile?.attemptHistory   || [];
    const failureMap       = profile?.failureMap       || {};
    const masteryMap       = profile?.masteryMap       || {};
    let recentAttemptIds = (profile?.recentAttemptIds || []).map(r => r.id);

    // Optionally exclude questions uploaded/created by the user
    if (req.body.excludeOwn) {
      const ownIds = await getUserQuestionIds(userId);
      recentAttemptIds = [...new Set([...(recentAttemptIds || []), ...ownIds])];
    }

    // 2. Apply mode overrides to subjects/count
    let effectiveSubjects = subjects;
    let effectiveCount    = questionCount;

    if (mode === "weak-only") {
      // Only topics with accuracy < 60%
      effectiveSubjects = subjects; // analyzer will auto-filter
      effectiveCount    = Math.min(questionCount, 30);
    } else if (mode === "revision") {
      // Focus on topics not practiced in 7+ days
      effectiveCount = Math.min(questionCount, 25);
    } else if (mode === "explore") {
      // 50% never-attempted topics
      effectiveCount = Math.min(questionCount, 20);
    }

    // 3. Azure OpenAI pattern analysis → quiz configuration
    const config = await analyzePatternAndConfigure({
      attemptHistory: attemptHistory.slice(-200), // last 200 attempts
      failureMap,
      masteryMap,
      subjects: effectiveSubjects,
      questionCount: effectiveCount,
      mode,
    });

    // If client supplied explicit topics, override analyzer with simple allocation
    if (Array.isArray(req.body.topics) && req.body.topics.length > 0) {
      const topics = req.body.topics.slice(0, 6);
      const perTopic = Math.floor(effectiveCount / topics.length);
      const remainder = effectiveCount - perTopic * topics.length;
      config.topicAllocations = topics.map((t, i) => ({
        topic: t,
        subject: effectiveSubjects[0] || 'Reasoning',
        questionCount: perTopic + (i === 0 ? remainder : 0),
        difficultyMix: { easy: Math.ceil((perTopic + (i === 0 ? remainder : 0)) * 0.4), medium: Math.ceil((perTopic + (i === 0 ? remainder : 0)) * 0.4), hard: 0 },
        reason: 'User selected topic',
      }));
      config.quizStrategy = 'developing';
    }

    // 4. Build quiz from Cosmos DB
    const { questions, meta } = await buildAdaptiveQuiz(config, recentAttemptIds);

    if (questions.length === 0) {
      // Avoid returning the raw `config` object which may contain
      // non-serializable fields from the analyzer (can cause
      // "Converting circular structure to JSON" errors).
      return res.status(404).json({
        error: "No questions found for your profile. Try adding more topics to your question bank.",
        // Send a small, safe summary instead of the full config
        configSummary: {
          topicCount: Array.isArray(config?.topicAllocations) ? config.topicAllocations.length : 0,
          quizStrategy: config?.quizStrategy || null,
          estimatedDuration: config?.estimatedDuration || null,
        },
      });
    }

    // 5. Strip correct answers from response (sent separately for security)
    const safeQuestions = questions.map(q => ({
      id:              q.id,
      topic:           q.topic,
      subject:         q.subject,
      chapter:         q.chapter,
      concept:         q.concept,
      difficulty:      q.difficulty,
      question:        q.question,
      options:         q.options,
      exam:            q.exam,
      _adaptiveReason: q._adaptiveReason,
      // correctAnswer and solution stripped here — sent via /submit
    }));

    // 6. Store answer key in session/cache (keyed by quizId)
    const quizId = `quiz_${userId}_${Date.now()}`;
    const answerKey = {};
    for (const q of questions) {
      answerKey[q.id] = {
        correctAnswer: q.correctAnswer,
        correctLetter: q.correctLetter,
        solution:      q.solution,
        topic:         q.topic,
        subject:       q.subject,
        concept:       q.concept,
      };
    }

    // Store in Express session
    if (req.session) {
      req.session[quizId] = { answerKey, userId, createdAt: Date.now() };
    }

    res.json({
      quizId,
      questions: safeQuestions,
      meta,
    });

  } catch (err) {
    console.error("[adaptive-quiz/generate]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/adaptive-quiz/submit
// Submit quiz answers, get results + tags
// Body: { quizId, userId, answers: [{ questionId, userAnswer, timeSpent, changedAnswer }] }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/submit", async (req, res) => {
  try {
    const { quizId, userId, answers } = req.body;

    if (!quizId || !userId || !Array.isArray(answers)) {
      return res.status(400).json({ error: "quizId, userId, and answers[] required" });
    }

    // Retrieve answer key from session
    const session = req.session?.[quizId];
    if (!session) {
      return res.status(404).json({ error: "Quiz session expired or not found. Please generate a new quiz." });
    }

    const { answerKey } = session;
    let correct = 0;
    const results = [];
    const attempts = [];

    for (const answer of answers) {
      const key = answerKey[answer.questionId];
      if (!key) continue;

      const isCorrect = answer.userAnswer === key.correctAnswer
        || answer.userAnswer === key.correctLetter;

      if (isCorrect) correct++;

      results.push({
        questionId:    answer.questionId,
        isCorrect,
        correctAnswer: key.correctAnswer,
        correctLetter: key.correctLetter,
        solution:      key.solution,
        userAnswer:    answer.userAnswer,
        topic:         key.topic,
        subject:       key.subject,
        concept:       key.concept,
        timeSpent:     answer.timeSpent || 0,
      });

      attempts.push({
        questionId:    answer.questionId,
        topic:         key.topic,
        subject:       key.subject,
        concept:       key.concept,
        isCorrect,
        timeSpent:     answer.timeSpent || 0,
        changedAnswer: answer.changedAnswer || false,
        attemptedAt:   new Date().toISOString(),
      });
    }

    // Save to user profile (updates mastery map)
    await saveQuizAttempts(userId, attempts);

    // Clean up session
    if (req.session) {
      delete req.session[quizId];
    }

    const score = answers.length > 0 ? Math.round((correct / answers.length) * 100) : 0;

    // Topic-wise accuracy for frontend chart
    const topicAccuracy = {};
    for (const r of results) {
      if (!topicAccuracy[r.topic]) topicAccuracy[r.topic] = { correct: 0, total: 0 };
      topicAccuracy[r.topic].total++;
      if (r.isCorrect) topicAccuracy[r.topic].correct++;
    }

    res.json({
      score,
      correct,
      total:         answers.length,
      results,
      topicAccuracy: Object.entries(topicAccuracy).map(([topic, s]) => ({
        topic,
        accuracy: Math.round((s.correct / s.total) * 100),
        correct:  s.correct,
        total:    s.total,
      })),
    });

  } catch (err) {
    console.error("[adaptive-quiz/submit]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/adaptive-quiz/preview/:userId
// Returns what the next adaptive quiz would look like (no questions fetched)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/preview/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const subjects = req.query.subjects
      ? req.query.subjects.split(",")
      : ["Reasoning", "Mathematics", "English", "General Awareness"];
    const questionCount = parseInt(req.query.count) || 20;

    const profile = await getUserProfile(userId);
    const config  = await analyzePatternAndConfigure({
      attemptHistory: (profile?.attemptHistory || []).slice(-200),
      failureMap:     profile?.failureMap || {},
      masteryMap:     profile?.masteryMap || {},
      subjects,
      questionCount,
    });

    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/adaptive-quiz/topics
// Returns available topics grouped by subject for the frontend topic picker
router.get('/topics', async (req, res) => {
  try {
    res.json({ subjects: SUBJECT_TOPICS });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

