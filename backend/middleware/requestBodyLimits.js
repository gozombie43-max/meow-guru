import express from 'express';

const normalJson = express.json({ limit: '256kb' });
const bulkJson = express.json({ limit: '10mb' });
const notesJson = express.json({ limit: '2mb' });
export function requestBodyLimits(req, res, next) {
  const path = req.path.replace(/\/+$/, '');
  if (req.method === 'POST' && ['/api/questions/bulk', '/api/questions/bulk-delete', '/api/questions/check-duplicates', '/api/mocktest/admin/upload-paper'].includes(path)) return bulkJson(req, res, next);
  if (path === '/api/notes' || path.startsWith('/api/notes/') || path.startsWith('/users/me/ai-chats/')) return notesJson(req, res, next);
  return normalJson(req, res, next);
}
