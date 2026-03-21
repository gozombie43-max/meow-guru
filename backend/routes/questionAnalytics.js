const express = require('express');
const router = express.Router();
const { overviewAnalytics, questionDeepDive } = require('../../analysis/questionAnalytics');

// GET /api/question-analytics — Overview: most missed, easiest, slowest, heatmap
router.get('/', (req, res) => {
  const report = overviewAnalytics();
  res.json(report);
});

// GET /api/question-analytics/:questionId — Deep dive for a single question
router.get('/:questionId', (req, res) => {
  const id = parseInt(req.params.questionId, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'questionId must be a number' });
  }

  const result = questionDeepDive(id);
  if (!result) {
    return res.status(404).json({ error: 'Question not found' });
  }
  res.json(result);
});

module.exports = router;
