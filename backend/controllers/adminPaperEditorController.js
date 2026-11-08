import { fetchAdminPaperQuestions, saveAdminPaperQuestions } from '../services/mock/adminPaperEditor.js';
import { runtimeLog } from '../infrastructure/runtimeLog.js';

export async function adminGetPaperQuestions(req, res) {
  try {
    res.json(await fetchAdminPaperQuestions(req.query.examSlug, req.params.slotId, req.query.examMode));
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) runtimeLog.error('Admin get paper questions error:', error);
    res.status(status).json({ error: status < 500 ? error.message : 'Could not load paper questions' });
  }
}

export async function adminSavePaperQuestions(req, res) {
  try {
    const { examSlug, ...input } = req.body;
    res.json(await saveAdminPaperQuestions(examSlug, req.params.slotId, req.query.examMode, input));
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) runtimeLog.error('Admin save paper questions error:', error);
    res.status(status).json({ error: status < 500 ? error.message : 'Could not save paper questions' });
  }
}
