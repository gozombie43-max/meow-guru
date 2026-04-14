// controllers/questionController.js
import { getQuestionsContainer } from '../containerStore.js';

// ── Helpers (kept from your original) ─────────────────
function buildRichText(textValue, imagePath) {
  const text  = (textValue  || '').trim();
  const image = (imagePath || '').trim();
  if (!text && !image) return '';
  if (!image) return text;
  if (!text)  return `![image](${image})`;
  return `${text}\n\n![image](${image})`;
}

function pickFile(files, key) {
  if (!files || !files[key] || !files[key][0]) return null;
  return files[key][0];
}

function uploadedPath(file) {
  if (!file || !file.filename) return '';
  return `/uploads/${file.filename}`;
}

function ciMatch(a, b) {
  return (a || '').toLowerCase() === (b || '').toLowerCase();
}

// ── POST /api/questions ────────────────────────────────
const addQuestion = async (req, res) => {
  try {
    const container = getQuestionsContainer();

    const {
      subject, tier, chapter, concept, difficulty,
      formula, trapType, question, questionText,
      optionAText, optionBText, optionCText, optionDText,
      options: optionsBody, correctAnswer: correctAnswerBody,
      correctIndex, solution: solutionBody, solutionText,
    } = req.body;

    const questionImagePath = uploadedPath(pickFile(req.files, 'questionImage'));
    const questionValue     = buildRichText(questionText ?? question, questionImagePath);

    let options = Array.isArray(optionsBody) ? optionsBody : null;
    if (!options && typeof optionsBody === 'string') {
      try {
        const parsed = JSON.parse(optionsBody);
        if (Array.isArray(parsed)) options = parsed;
      } catch { options = null; }
    }

    if (!options) {
      const optionTexts  = [optionAText, optionBText, optionCText, optionDText];
      const optionImages = [
        uploadedPath(pickFile(req.files, 'optionAImage')),
        uploadedPath(pickFile(req.files, 'optionBImage')),
        uploadedPath(pickFile(req.files, 'optionCImage')),
        uploadedPath(pickFile(req.files, 'optionDImage')),
      ];
      options = optionTexts.map((text, i) => buildRichText(text, optionImages[i]));
    }

    const parsedCorrectIndex = Number.isFinite(Number(correctIndex))
      ? parseInt(correctIndex, 10) : null;

    let correctAnswer = correctAnswerBody;
    if (parsedCorrectIndex !== null) {
      if (parsedCorrectIndex < 0 || parsedCorrectIndex >= options.length)
        return res.status(400).json({ error: 'correctIndex is out of range' });
      correctAnswer = options[parsedCorrectIndex];
    }

    if (typeof correctAnswer === 'number') {
      if (correctAnswer < 0 || correctAnswer >= options.length)
        return res.status(400).json({ error: 'correctAnswer index is out of range' });
      correctAnswer = options[correctAnswer];
    }

    const solutionImagePath = uploadedPath(pickFile(req.files, 'solutionImage'));
    const solutionValue     = buildRichText(solutionText ?? solutionBody, solutionImagePath);

    if (!subject || !questionValue || !options || correctAnswer === undefined)
      return res.status(400).json({ error: 'Missing required fields' });

    if (!Array.isArray(options) || options.length < 2)
      return res.status(400).json({ error: 'options must have at least 2 choices' });

    const emptyIndex = options.findIndex(opt => !String(opt || '').trim());
    if (emptyIndex !== -1)
      return res.status(400).json({ error: 'Each option needs text or an image' });

    if (!options.includes(correctAnswer))
      return res.status(400).json({ error: 'correctAnswer must be one of the provided options' });

    const newQuestion = {
      id:          `q_${Date.now()}`,
      topic:       chapter || subject,   // ← partition key REQUIRED
      subject,
      tier:        tier        || '',
      chapter:     chapter     || '',
      concept:     concept     || '',
      difficulty:  difficulty  || 'medium',
      formula:     formula     || '',
      trapType:    trapType    || '',
      question:    questionValue,
      options,
      correctAnswer,
      solution:    solutionValue,
      createdAt:   new Date().toISOString(),
    };

    await container.items.create(newQuestion);
    res.status(201).json({ message: 'Question added ✅', question: newQuestion });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/questions ─────────────────────────────────
const getQuestions = async (req, res) => {
  try {
    const container = getQuestionsContainer();
    const { topic, subject, chapter, concept, difficulty, offset = 0, limit } = req.query;

    let query = 'SELECT * FROM c WHERE 1=1';
    const parameters = [];

    if (topic) {
      query += ' AND (LOWER(c.topic) = LOWER(@topic) OR LOWER(c.chapter) = LOWER(@topic) OR LOWER(c.subject) = LOWER(@topic))';
      parameters.push({ name: '@topic', value: topic });
    }
    if (subject) {
      query += ' AND LOWER(c.subject) = LOWER(@subject)';
      parameters.push({ name: '@subject', value: subject });
    }
    if (chapter) {
      query += ' AND LOWER(c.chapter) = LOWER(@chapter)';
      parameters.push({ name: '@chapter', value: chapter });
    }
    if (concept) {
      query += ' AND LOWER(c.concept) = LOWER(@concept)';
      parameters.push({ name: '@concept', value: concept });
    }
    if (difficulty) {
      query += ' AND LOWER(c.difficulty) = LOWER(@difficulty)';
      parameters.push({ name: '@difficulty', value: difficulty });
    }

    const parsedOffset = Number.isFinite(Number(offset)) ? parseInt(offset, 10) : 0;
    const parsedLimit = Number.isFinite(Number(limit)) ? parseInt(limit, 10) : null;

    if (parsedLimit !== null && parsedLimit > 0) {
      query += ` OFFSET ${parsedOffset} LIMIT ${parsedLimit}`;
    } else if (parsedOffset > 0) {
      query += ` OFFSET ${parsedOffset} LIMIT 99999`;
    }

    const { resources } = await container.items
      .query({ query, parameters })
      .fetchAll();

    res.set("Cache-Control", "public, max-age=300");
    res.json({ count: resources.length, questions: resources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/questions/practice-test ──────────────────
const generatePracticeTest = async (req, res) => {
  try {
    const container = getQuestionsContainer();
    const { subject, difficulty, count = 10 } = req.query;
    const limit = Math.min(parseInt(count, 10) || 10, 100);

    let query = 'SELECT * FROM c WHERE 1=1';
    const parameters = [];

    if (subject) {
      query += ' AND LOWER(c.subject) = LOWER(@subject)';
      parameters.push({ name: '@subject', value: subject });
    }
    if (difficulty) {
      query += ' AND LOWER(c.difficulty) = LOWER(@difficulty)';
      parameters.push({ name: '@difficulty', value: difficulty });
    }

    // Fetch more than needed, then shuffle
    query += ` OFFSET 0 LIMIT ${limit * 3}`;

    const { resources } = await container.items
      .query({ query, parameters })
      .fetchAll();

    if (resources.length === 0)
      return res.status(404).json({ error: 'No questions found matching criteria' });

    const shuffled = resources
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(limit, resources.length))
      .map(q => ({
        id:         q.id,
        subject:    q.subject,
        chapter:    q.chapter,
        concept:    q.concept,
        question:   q.question,
        options:    q.options,
        difficulty: q.difficulty,
      }));

    res.json({
      testName:       `SSC Practice Test — ${subject || 'Mixed'}`,
      totalQuestions: shuffled.length,
      questions:      shuffled,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/questions/analyze ───────────────────────
const runAnalysis = async (req, res) => {
  try {
    const container = getQuestionsContainer();
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0)
      return res.status(400).json({ error: 'answers must be a non-empty array' });

    // Fetch all questions by id
    const ids = answers.map(a => a.questionId);

    // Cosmos doesn't support IN queries easily, so fetch in parallel
    const questionDocs = await Promise.all(
      ids.map(async (id) => {
        try {
          const query = {
            query: 'SELECT * FROM c WHERE c.id = @id',
            parameters: [{ name: '@id', value: id }],
          };
          const { resources } = await container.items.query(query).fetchAll();
          return resources[0] || null;
        } catch { return null; }
      })
    );

    const questionMap = new Map(
      questionDocs.filter(Boolean).map(q => [q.id, q])
    );

    let correct = 0, incorrect = 0, unattempted = 0;
    const subjectBreakdown = {};
    const details = [];

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;

      const subj = q.subject;
      if (!subjectBreakdown[subj])
        subjectBreakdown[subj] = { correct: 0, incorrect: 0, unattempted: 0, total: 0 };

      subjectBreakdown[subj].total++;

      if (ans.selectedAnswer === null || ans.selectedAnswer === undefined) {
        unattempted++;
        subjectBreakdown[subj].unattempted++;
        details.push({ questionId: q.id, status: 'unattempted' });
      } else if (ans.selectedAnswer === q.correctAnswer) {
        correct++;
        subjectBreakdown[subj].correct++;
        details.push({ questionId: q.id, status: 'correct' });
      } else {
        incorrect++;
        subjectBreakdown[subj].incorrect++;
        details.push({ questionId: q.id, status: 'incorrect', correctAnswer: q.correctAnswer });
      }
    }

    const total = correct + incorrect + unattempted;
    const scorePercent = total > 0 ? ((correct / total) * 100).toFixed(2) : 0;

    res.json({
      summary: { totalQuestions: total, correct, incorrect, unattempted, scorePercent: parseFloat(scorePercent) },
      subjectBreakdown,
      details,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/questions/:id ─────────────────────────────
const getQuestionById = async (req, res) => {
  try {
    const container = getQuestionsContainer();
    const { id } = req.params;
    const { resources } = await container.items
      .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
      .fetchAll();
    if (!resources.length) return res.status(404).json({ error: 'Not found' });
    res.set("Cache-Control", "public, max-age=300");
    res.json(resources[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /api/questions/:id ─────────────────────────────
const updateQuestion = async (req, res) => {
  try {
    const container = getQuestionsContainer();
    const { id } = req.params;
    // fetch existing to get partition key (topic)
    const { resources } = await container.items
      .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
      .fetchAll();
    if (!resources.length) return res.status(404).json({ error: 'Not found' });
    const existing = resources[0];
    const updated = { ...existing, ...req.body, id, topic: req.body.topic || existing.topic };
    await container.items.upsert(updated);
    res.json({ message: 'Updated ✅', question: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/questions/:id ──────────────────────────
const deleteQuestion = async (req, res) => {
  try {
    const container = getQuestionsContainer();
    const { id } = req.params;
    // fetch to get partition key (topic) — required for delete
    const { resources } = await container.items
      .query({ query: 'SELECT * FROM c WHERE c.id = @id', parameters: [{ name: '@id', value: id }] })
      .fetchAll();
    if (!resources.length) return res.status(404).json({ error: 'Not found' });
    const { topic } = resources[0];
    await container.item(id, topic).delete();
    res.json({ message: 'Deleted ✅' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default { addQuestion, getQuestionById, updateQuestion, deleteQuestion, getQuestions, generatePracticeTest, runAnalysis };