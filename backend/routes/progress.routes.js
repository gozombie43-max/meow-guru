import express from 'express';
import { optionalAuth, protect } from '../middleware/protect.js';
import { fetchTopicCountSnapshot } from '../services/questions/topicCountSnapshot.js';
import { readUserTopicProgress } from '../repositories/questionProgressRepository.js';
import { cachedTopicProgress } from '../services/questions/topicProgressCache.js';

const router = express.Router();

router.get('/topics/private', protect, async (req, res) => {
  try {
    const subject = req.query.subject || 'mathematics';
    if (!['mathematics', 'reasoning', 'english', 'general-awareness'].includes(subject)) {
      return res.status(400).json({ error: 'Invalid subject' });
    }
    const userId = req.user._id || req.user.id;
    const docs = await cachedTopicProgress(userId, () => readUserTopicProgress(userId));
    const userProgress = Object.fromEntries(docs.map(doc => [doc.topic, {
      userSolved: doc.solvedCount || 0, userMastered: doc.masteredCount || 0,
    }]));
    res.set('Cache-Control', 'private, no-store');
    res.json({ subject, userProgress });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/topics', optionalAuth, async (req, res) => {
  try {
    const { subject } = req.query;
    const userId = req.user && (req.user._id || req.user.id);
    const [snapshot, progressDocs] = await Promise.all([
      fetchTopicCountSnapshot(subject || 'mathematics'),
      userId ? cachedTopicProgress(userId, () => readUserTopicProgress(userId)) : [],
    ]);
    const progressMap = {};
    if (userId) {
      for (const doc of progressDocs) {
        progressMap[doc.topic] = {
          userSolved: doc.solvedCount || 0,
          userMastered: doc.masteredCount || 0
        };
      }
    }

    res.set('Cache-Control', 'no-cache');
    res.json({
      subject: snapshot.subject,
      revision: snapshot.revision,
      updatedAt: snapshot.updatedAt,
      totals: snapshot.totals,
      userProgress: progressMap
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

export default router;
