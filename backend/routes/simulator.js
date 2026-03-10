const express = require('express');
const router = express.Router();
const { createExam, evaluateExam } = require('../../analysis/examSimulator');

// POST /api/simulator/start — Create a new exam paper
//   body: { subject?, count?, timeLimitMin?, tier?, hardRatio? }
router.post('/start', (req, res) => {
  const { subject, count, timeLimitMin, tier, hardRatio } = req.body;
  const exam = createExam({ subject, count, timeLimitMin, tier, hardRatio });

  if (exam.error) {
    return res.status(404).json({ error: exam.error });
  }

  // Strip internal answer key before sending to client
  const { _answerKey, ...response } = exam;
  res.json(response);
});

// POST /api/simulator/submit — Submit answers and get scored report
//   body: { examId?, tier?, timeLimitMin?, timeTakenMin?, answers: [{ questionId, selectedAnswer, timeSpentSec? }] }
router.post('/submit', (req, res) => {
  const { examId, tier, timeLimitMin, timeTakenMin, answers } = req.body;

  if (!Array.isArray(answers)) {
    return res.status(400).json({ error: 'answers must be an array of { questionId, selectedAnswer }' });
  }

  const result = evaluateExam({ examId, tier, timeLimitMin, answers, timeTakenMin });

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  res.json(result);
});

module.exports = router;
