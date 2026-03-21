const express = require('express');
const router = express.Router();
const { readQuestions, shuffle, ciMatch } = require('../../database/db');

// GET /api/practice?subject=&chapter=&concept=&difficulty=&count=
router.get('/', (req, res) => {
  let questions = readQuestions();
  const { subject, chapter, concept, difficulty, count } = req.query;

  if (subject)    questions = questions.filter(q => ciMatch(q.subject, subject));
  if (chapter)    questions = questions.filter(q => ciMatch(q.chapter, chapter));
  if (concept)    questions = questions.filter(q => ciMatch(q.concept, concept));
  if (difficulty) questions = questions.filter(q => ciMatch(q.difficulty, difficulty));

  if (questions.length === 0) {
    return res.json({ count: 0, questions: [] });
  }

  questions = shuffle(questions);

  const limit = Math.min(parseInt(count, 10) || questions.length, questions.length, 100);
  const selected = questions.slice(0, limit);

  res.json({
    count: selected.length,
    filters: { subject: subject || null, chapter: chapter || null, concept: concept || null, difficulty: difficulty || null },
    questions: selected
  });
});

module.exports = router;
