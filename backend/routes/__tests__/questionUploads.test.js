import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';

const { putObject, deleteObject, createQuestion } = vi.hoisted(() => ({ putObject: vi.fn(), deleteObject: vi.fn(), createQuestion: vi.fn() }));
vi.mock('../../infrastructure/objectStorage.js', () => ({ putObject, deleteObject, stableImageUrl: key => `/api/upload/image/${Buffer.from(key).toString('base64url')}` }));
vi.mock('../../services/questionService.js', () => ({ createQuestion }));
vi.mock('../../middleware/auth.js', () => ({ default: (_req, _res, next) => next() }));
import router from '../questionRoutes.js';

let server, base;
beforeAll(async () => {
  const app = express();
  app.use('/api/questions', router);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/questions`;
});
afterAll(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => { vi.resetAllMocks(); putObject.mockResolvedValue(undefined); deleteObject.mockResolvedValue(undefined); createQuestion.mockImplementation(async row => row); });
function form(valid = true) {
  const body = new FormData();
  if (valid) body.set('subject', 'Mathematics');
  body.set('questionText', 'Question');
  body.set('optionAText', 'First'); body.set('optionBText', 'Second');
  body.set('optionCText', 'Third'); body.set('optionDText', 'Fourth');
  body.set('correctIndex', '0');
  body.set('questionImage', new Blob(['question'], { type: 'image/png' }), 'q.png');
  body.set('optionAImage', new Blob(['option'], { type: 'image/png' }), 'a.png');
  return body;
}
it('stores question and option image references using the shared resolver', async () => {
  const response = await fetch(base, { method: 'POST', body: form() });
  expect(response.status).toBe(201);
  const saved = createQuestion.mock.calls[0][0];
  expect(saved.question).toContain('/api/upload/image/');
  expect(saved.options[0]).toContain('/api/upload/image/');
  expect(saved.correctAnswer).toBe(saved.options[0]);
  expect(JSON.stringify(saved)).not.toContain('/uploads/');
  expect(putObject).toHaveBeenCalledTimes(2);
  expect(deleteObject).not.toHaveBeenCalled();
});
it('cleans uploaded objects when question validation rejects the request', async () => {
  const response = await fetch(base, { method: 'POST', body: form(false) });
  expect(response.status).toBe(400);
  await vi.waitFor(() => expect(deleteObject).toHaveBeenCalledTimes(2));
  expect(createQuestion).not.toHaveBeenCalled();
});
it('cleans completed uploads after a partial storage failure', async () => {
  putObject.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Storage unavailable'));
  const response = await fetch(base, { method: 'POST', body: form() });
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(deleteObject).toHaveBeenCalledTimes(1);
  expect(createQuestion).not.toHaveBeenCalled();
});
