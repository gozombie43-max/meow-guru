const { readQuestions, writeQuestions, nextQuestionId, shuffle, ciMatch } = require('../../database/db');

// POST /api/questions — Add a new question
exports.addQuestion = (req, res) => {
  const { subject, tier, chapter, concept, difficulty, formula, trapType, question, options, correctAnswer } = req.body;

  if (!subject || !question || !options || correctAnswer === undefined) {
    return res.status(400).json({ error: 'Missing required fields: subject, question, options, correctAnswer' });
  }

  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'options must be an array with at least 2 choices' });
  }

  if (!options.includes(correctAnswer)) {
    return res.status(400).json({ error: 'correctAnswer must be one of the provided options' });
  }

  const questions = readQuestions();

  const newQuestion = {
    id: nextQuestionId(questions),
    subject,
    tier: tier || '',
    chapter: chapter || '',
    concept: concept || '',
    difficulty: difficulty || 'medium',
    formula: formula || '',
    trapType: trapType || '',
    question,
    options,
    correctAnswer,
    createdAt: new Date().toISOString()
  };

  questions.push(newQuestion);
  writeQuestions(questions);

  res.status(201).json({ message: 'Question added successfully', question: newQuestion });
};

// GET /api/questions — Get all questions (with optional filters)
exports.getQuestions = (req, res) => {
  let questions = readQuestions();
  const { subject, chapter, concept, difficulty } = req.query;

  if (subject) {
    questions = questions.filter(q => ciMatch(q.subject, subject));
  }
  if (chapter) {
    questions = questions.filter(q => ciMatch(q.chapter, chapter));
  }
  if (concept) {
    questions = questions.filter(q => ciMatch(q.concept, concept));
  }
  if (difficulty) {
    questions = questions.filter(q => ciMatch(q.difficulty, difficulty));
  }

  res.json({ count: questions.length, questions });
};

// GET /api/questions/practice-test — Generate a random practice test
exports.generatePracticeTest = (req, res) => {
  let questions = readQuestions();
  const { subject, count = 10, difficulty } = req.query;
  const limit = Math.min(parseInt(count, 10) || 10, 100);

  if (subject) {
    questions = questions.filter(q => ciMatch(q.subject, subject));
  }
  if (difficulty) {
    questions = questions.filter(q => ciMatch(q.difficulty, difficulty));
  }

  if (questions.length === 0) {
    return res.status(404).json({ error: 'No questions found matching the criteria' });
  }

  questions = shuffle(questions);

  const testQuestions = questions.slice(0, Math.min(limit, questions.length)).map(q => ({
    id: q.id,
    subject: q.subject,
    chapter: q.chapter,
    concept: q.concept,
    question: q.question,
    options: q.options,
    difficulty: q.difficulty
  }));

  res.json({
    testName: `SSC Practice Test — ${subject || 'Mixed'}`,
    totalQuestions: testQuestions.length,
    questions: testQuestions
  });
};

// POST /api/questions/analyze — Run exam analysis on submitted answers
exports.runAnalysis = (req, res) => {
  const { answers } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers must be a non-empty array of { questionId, selectedAnswer }' });
  }

  const allQuestions = readQuestions();
  const questionMap = new Map(allQuestions.map(q => [q.id, q]));

  let correct = 0;
  let incorrect = 0;
  let unattempted = 0;
  const subjectBreakdown = {};
  const details = [];

  for (const ans of answers) {
    const q = questionMap.get(ans.questionId);
    if (!q) continue;

    const subj = q.subject;
    if (!subjectBreakdown[subj]) {
      subjectBreakdown[subj] = { correct: 0, incorrect: 0, unattempted: 0, total: 0 };
    }
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
    summary: {
      totalQuestions: total,
      correct,
      incorrect,
      unattempted,
      scorePercent: parseFloat(scorePercent)
    },
    subjectBreakdown,
    details
  });
};
