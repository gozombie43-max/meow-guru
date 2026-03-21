const express = require('express');
const router = express.Router();
const { analyze } = require('../../analysis/patternAnalyzer');

// GET /api/analysis — Full dataset analysis
router.get('/', (req, res) => {
  const report = analyze();
  res.json(report);
});

module.exports = router;
