const express = require('express');
const router = express.Router();
const { analyzeTrapFrequency } = require('../../analysis/trapAnalyzer');

// GET /api/traps — Full trap analysis report
router.get('/', (req, res) => {
  res.json(analyzeTrapFrequency());
});

module.exports = router;
