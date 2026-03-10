const express = require('express');
const cors = require('cors');
const path = require('path');
const questionRoutes = require('./routes/questionRoutes');
const practiceRoutes = require('./routes/practice');
const analysisRoutes = require('./routes/analysis');
const generatorRoutes = require('./routes/generator');
const performanceRoutes = require('./routes/performance');
const questionAnalyticsRoutes = require('./routes/questionAnalytics');
const examinerRoutes = require('./routes/examiner');
const studentProfileRoutes = require('./routes/studentProfile');
const trapRoutes = require('./routes/traps');
const adaptiveRoutes = require('./routes/adaptive');
const simulatorRoutes = require('./routes/simulator');
const { generateExamInsights } = require('../analysis/aiExaminer');
const connectDB = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve admin UI
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// Serve frontend
app.use('/app', express.static(path.join(__dirname, '..', 'frontend')));

// Routes
app.use('/api/questions', questionRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/generate', generatorRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/question-analytics', questionAnalyticsRoutes);
app.use('/api/examiner', examinerRoutes);
app.use('/api/student-profile', studentProfileRoutes);
app.use('/api/traps', trapRoutes);
app.use('/api/adaptive', adaptiveRoutes);
app.use('/api/simulator', simulatorRoutes);

// GET /exam-analysis — Full exam pattern report from aiExaminer
app.get('/exam-analysis', (req, res) => {
  res.json(generateExamInsights());
});

// Get questions from MongoDB
app.get('/questions', async (req, res) => {
  const db = await connectDB();
  const questions = await db
    .collection('questions')
    .find({})
    .limit(20)
    .toArray();
  res.json(questions);
});

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'SSC Exam Practice Platform API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
