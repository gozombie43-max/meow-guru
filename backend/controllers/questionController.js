// controllers/questionController.js
import * as questionService from '../services/questionService.js';

// ── Helpers (kept from your original for req parsing) ─
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

// ── POST /api/questions ────────────────────────────────
const addQuestion = async (req, res) => {
  try {
    const {
      subject, tier, chapter, concept, difficulty,
      formula, trapType, question, questionText,
      optionAText, optionBText, optionCText, optionDText,
      options: optionsBody, correctAnswer: correctAnswerBody,
      correctIndex, solution: solutionBody, solutionText,
      quizSubject, quizTopic, quizName,
    } = req.body;

    const normalizedQuizSubject = String(quizSubject || "").trim();
    const normalizedQuizTopic = String(quizTopic || "").trim();
    const normalizedQuizName = String(quizName || "").trim();
    const normalizedSubject = String(subject || normalizedQuizSubject || "").trim();
    const normalizedChapter = String(chapter || normalizedQuizTopic || "").trim();
    const normalizedTopic = String(normalizedQuizTopic || chapter || subject || normalizedQuizSubject || "").trim();

    if (/study\s*mode/i.test(normalizedQuizName)) {
      return res.status(400).json({
        error: 'Study Mode uploads must use the study-mode schema via bulk upload.',
      });
    }

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

    if (!normalizedSubject || !questionValue || !options || correctAnswer === undefined)
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
      topic:       normalizedTopic || normalizedChapter || normalizedSubject,
      subject:     normalizedSubject,
      tier:        tier        || '',
      chapter:     normalizedChapter,
      quizSubject: normalizedQuizSubject || normalizedSubject,
      quizTopic:   normalizedQuizTopic || normalizedTopic,
      quizName:    normalizedQuizName,
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

    const resource = await questionService.createQuestion(newQuestion);
    res.status(201).json({ message: 'Question added ✅', question: resource });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/questions ─────────────────────────────────
const getQuestions = async (req, res) => {
  try {
    const result = await questionService.fetchQuestions(req.query);
    res.set("Cache-Control", "no-store, max-age=0");
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/questions/practice-test ──────────────────
const generatePracticeTest = async (req, res) => {
  try {
    const questions = await questionService.fetchPracticeTest(req.query);
    if (!questions) {
      return res.status(404).json({ error: 'No questions found matching criteria' });
    }
    res.json({
      testName:       `SSC Practice Test — ${req.query.subject || 'Mixed'}`,
      totalQuestions: questions.length,
      questions:      questions,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/questions/analyze ───────────────────────
const runAnalysis = async (req, res) => {
  try {
    const { answers } = req.body;
    if (!Array.isArray(answers) || answers.length === 0)
      return res.status(400).json({ error: 'answers must be a non-empty array' });

    const analysis = await questionService.analyzeAnswers(answers);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/questions/:id ─────────────────────────────
const getQuestionById = async (req, res) => {
  try {
    const question = await questionService.fetchQuestionById(req.params.id);
    if (!question) return res.status(404).json({ error: 'Not found' });
    res.set("Cache-Control", "no-store, max-age=0");
    res.json(question);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /api/questions/:id ─────────────────────────────
const updateQuestion = async (req, res) => {
  try {
    const updated = await questionService.modifyQuestion(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Updated ✅', question: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/questions/:id ──────────────────────────
const deleteQuestion = async (req, res) => {
  try {
    const success = await questionService.removeQuestion(req.params.id);
    if (!success) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted ✅' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── BULK /api/questions/bulk ──────────────────────────
const bulkCreateQuestions = async (req, res) => {
  try {
    const questions = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Body must be a non-empty array' });
    }

    const results = await questionService.createQuestionsBulk(questions);
    
    const inserted = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return res.json({ inserted, failed, total: questions.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── POST /api/questions/check-duplicates ──────────────
const checkDuplicates = async (req, res) => {
  try {
    const { questions } = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions must be a non-empty array' });
    }

    const duplicates = await questionService.checkDuplicates(questions);
    return res.json({ results: duplicates });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ── GET /api/questions/image ──────────────────────────
const getImageQuestions = async (req, res) => {
  try {
    const { topic, limit } = req.query;
    const result = await questionService.fetchImageQuestions(topic, limit);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export default { 
  addQuestion, 
  getQuestionById, 
  updateQuestion, 
  deleteQuestion, 
  getQuestions, 
  generatePracticeTest, 
  runAnalysis,
  bulkCreateQuestions,
  checkDuplicates,
  getImageQuestions
};
