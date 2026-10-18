import { fetchAdminPaperQuestions, saveAdminPaperQuestions } from '../services/mock/adminPaperEditor.js';

export async function adminGetPaperQuestions(req, res) {
  try {
    res.json(await fetchAdminPaperQuestions(req.query.examSlug, req.params.slotId, req.query.examMode));
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Could not load paper questions' }); }
}

export async function adminSavePaperQuestions(req, res) {
  try {
    const { examSlug, ...input } = req.body;
    res.json(await saveAdminPaperQuestions(examSlug, req.params.slotId, req.query.examMode, input));
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Could not save paper questions' }); }
}
