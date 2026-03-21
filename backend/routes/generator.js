const express = require('express');
const router = express.Router();
const { generate, getAvailableConcepts, generateExamQuestion } = require('../../generator/questionGenerator');

// GET /api/generate/concepts — List all available concept templates
router.get('/concepts', (req, res) => {
  res.json(getAvailableConcepts());
});

// GET /api/generate?concept=&difficulty=&count=
router.get('/', (req, res) => {
  const { concept, difficulty, count } = req.query;
  const result = generate({
    concept: concept || '',
    difficulty: difficulty || 'medium',
    count: parseInt(count, 10) || 5
  });

  if (result.error) {
    return res.status(404).json({ error: result.error });
  }

  res.json(result);
});

// GET /api/generate/exam-question?concept=&difficulty=&trapType=
router.get('/exam-question', (req, res) => {
  const { concept, difficulty, trapType } = req.query;
  const result = generateExamQuestion({
    concept: concept || '',
    difficulty: difficulty || 'medium',
    trapType: trapType || ''
  });

  if (result.error) {
    return res.status(404).json({ error: result.error });
  }

  res.json(result);
});

module.exports = router;
