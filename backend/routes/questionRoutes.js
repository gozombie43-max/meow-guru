const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');

// Add a new question
router.post('/', questionController.addQuestion);

// Get all questions (supports ?subject=&topic=&difficulty= filters)
router.get('/', questionController.getQuestions);

// Generate a random practice test (supports ?subject=&count=&difficulty=)
router.get('/practice-test', questionController.generatePracticeTest);

// Run exam analysis on submitted answers
router.post('/analyze', questionController.runAnalysis);

module.exports = router;
