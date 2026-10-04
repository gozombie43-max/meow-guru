import express from 'express';
import { speechRequestSchema, translationRequestSchema } from '@meow/contracts/speech';
import { synthesizeSpeech, translateTexts } from '../services/speechService.js';
import { protect } from '../middleware/protect.js';
import { aiAdmission } from '../middleware/aiAdmission.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
router.use(['/tts', '/translate'], protect, aiLimiter);
const validate = schema => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid speech or translation request' });
  req.body = parsed.data;
  next();
};
router.post('/tts', validate(speechRequestSchema), aiAdmission, async (req, res) => {
  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=300' }).send(await synthesizeSpeech(req.body));
});
router.post('/translate', validate(translationRequestSchema), aiAdmission, async (req, res) => {
  res.set('Cache-Control', 'no-store').json(await translateTexts(req.body));
});
export default router;
