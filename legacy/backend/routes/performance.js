const express = require('express');
const router = express.Router();
const { saveTestResult, analyzeTest, analyzeAll, readHistory } = require('../../analysis/performance');

// POST /api/performance — Submit a completed test with timing data
router.post('/', (req, res) => {
  const { answers, timeLimitSec } = req.body;

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers must be a non-empty array' });
  }

  const entry = saveTestResult({ answers, timeLimitSec });
  const analysis = analyzeTest(entry);

  res.status(201).json(analysis);
});

// GET /api/performance — Aggregate performance across all tests
router.get('/', (req, res) => {
  res.json(analyzeAll());
});

// GET /api/performance/:testId — Get analysis for a specific test
router.get('/:testId', (req, res) => {
  const id = parseInt(req.params.testId, 10);
  const history = readHistory();
  const entry = history.find(t => t.id === id);

  if (!entry) {
    return res.status(404).json({ error: 'Test not found' });
  }

  res.json(analyzeTest(entry));
});

module.exports = router;
