const express = require('express');
const router = express.Router();
const { evaluateFromHistory, evaluateFromAnswers } = require('../../analysis/adaptiveEngine');

// GET /api/adaptive — Next difficulty based on full test history
router.get('/', (req, res) => {
  res.json(evaluateFromHistory());
});

// POST /api/adaptive — Next difficulty from a submitted answer sequence
//   body: { answers: [{ selectedAnswer, correctAnswer }], startLevel?: "easy" }
router.post('/', (req, res) => {
  const { answers, startLevel } = req.body;

  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers must be an array of { selectedAnswer, correctAnswer }' });
  }

  res.json(evaluateFromAnswers(answers, startLevel));
});

module.exports = router;
