const express = require('express');
const router = express.Router();
const {
  analyzeConceptWeightage,
  detectCommonTraps,
  buildFormulaClusters,
  predictFutureQuestionTypes,
  generateExamInsights
} = require('../../analysis/aiExaminer');

// GET /api/examiner — Full combined insights report
router.get('/', (req, res) => {
  res.json(generateExamInsights());
});

// GET /api/examiner/weightage — Concept & chapter weightage
router.get('/weightage', (req, res) => {
  res.json(analyzeConceptWeightage());
});

// GET /api/examiner/traps — Common trap analysis
router.get('/traps', (req, res) => {
  res.json(detectCommonTraps());
});

// GET /api/examiner/formulas — Formula clusters
router.get('/formulas', (req, res) => {
  res.json(buildFormulaClusters());
});

// GET /api/examiner/predictions — Predicted future question types
router.get('/predictions', (req, res) => {
  res.json(predictFutureQuestionTypes());
});

module.exports = router;
