import express from 'express';
import { optionalAuth } from '../middleware/protect.js';
import { fetchTopicCountSnapshot } from '../services/questions/topicCountSnapshot.js';
import { getUserTopicProgressCollection } from '../config/mongodb.js';
import { readTopicProgressCache, writeTopicProgressCache } from '../services/questions/topicProgressCache.js';

const router = express.Router();

router.get('/topics', optionalAuth, async (req, res) => {
  try {
    const { subject } = req.query;
    // 1. Get base counts
    const snapshot = await fetchTopicCountSnapshot(subject || 'mathematics');
    
    // 2. Get user's progress
    const progressMap = {};
    if (req.user) {
      const userId = req.user._id || req.user.id;
      const cached = await readTopicProgressCache(userId);
      const progressDocs = cached?.value ?? await getUserTopicProgressCollection().find({ userId }).toArray();
      if (!cached?.value) await writeTopicProgressCache(cached?.key, progressDocs);
      
      // 3. Merge
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
