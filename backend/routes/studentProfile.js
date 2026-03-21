const express = require('express');
const router = express.Router();
const {
  calculateConceptAccuracy,
  detectWeakConcepts,
  generateStudentProfile
} = require('../../analysis/studentProfiler');

// GET /api/student-profile — Full student profile
router.get('/', (req, res) => {
  res.json(generateStudentProfile());
});

// GET /api/student-profile/accuracy — Per-concept accuracy breakdown
router.get('/accuracy', (req, res) => {
  res.json(calculateConceptAccuracy());
});

// GET /api/student-profile/weak — Weak & strong concepts split
router.get('/weak', (req, res) => {
  const threshold = parseInt(req.query.threshold, 10) || 60;
  res.json(detectWeakConcepts(threshold));
});

module.exports = router;
