import { idempotencyKeyHeaderSchema } from '../../../contracts/quiz-session.js';
import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import {
  createQuizSession,
  getQuizSessionQuestionsBatch,
  getQuizSessionResult,
  getQuizSessionState,
  submitQuizSession,
  submitQuizSessionAnswer,
} from '../../services/questions/quizSessionV1Service.js';

function sendSessionError(res, err, fallbackMessage = 'Quiz session request failed') {
  const status = err?.statusCode || err?.status || 500;
  if (status >= 500) {
    runtimeLog.error('Quiz session v1 controller error:', err);
  }
  const exposeMessage = Boolean((err?.statusCode || err?.status) && status !== 500);
  return res.status(status).json({
    error: exposeMessage ? err.message : fallbackMessage,
    ...(exposeMessage && err?.code ? { code: err.code } : {}),
  });
}

export async function createSessionHandler(req, res) {
  try {
    const result = await createQuizSession(req.user.id, req.body);
    res.set('Cache-Control', 'private, no-store');
    return res.status(201).json(result);
  } catch (err) {
    return sendSessionError(res, err, 'Failed to create quiz session');
  }
}

export async function getSessionHandler(req, res) {
  try {
    const state = await getQuizSessionState(req.params.id, req.user.id);
    res.set('Cache-Control', 'private, no-store');
    return res.json(state);
  } catch (err) {
    return sendSessionError(res, err, 'Failed to fetch quiz session');
  }
}

export async function getSessionQuestionsHandler(req, res) {
  try {
    const batch = await getQuizSessionQuestionsBatch(req.params.id, req.user.id, req.query);
    res.set('Cache-Control', 'private, no-store');
    return res.json(batch);
  } catch (err) {
    return sendSessionError(res, err, 'Failed to fetch quiz session questions');
  }
}

export async function submitSessionAnswerHandler(req, res) {
  try {
    const rawKey = req.get('Idempotency-Key');
    const parsedKey = idempotencyKeyHeaderSchema.safeParse(rawKey);
    if (!parsedKey.success) {
      return res.status(400).json({ error: 'Valid Idempotency-Key header is required' });
    }
    const { response, replayed } = await submitQuizSessionAnswer(
      req.params.id,
      req.user.id,
      req.body,
      parsedKey.data,
    );
    if (replayed) res.set('Idempotency-Replayed', 'true');
    res.set('Cache-Control', 'private, no-store');
    return res.json(response);
  } catch (err) {
    return sendSessionError(res, err, 'Failed to submit session answer');
  }
}

export async function submitSessionHandler(req, res) {
  try {
    const response = await submitQuizSession(req.params.id, req.user.id, req.body);
    res.set('Cache-Control', 'private, no-store');
    return res.json(response);
  } catch (err) {
    return sendSessionError(res, err, 'Failed to submit quiz session');
  }
}

export async function getSessionResultHandler(req, res) {
  try {
    const response = await getQuizSessionResult(req.params.id, req.user.id);
    res.set('Cache-Control', 'private, no-store');
    return res.json(response);
  } catch (err) {
    return sendSessionError(res, err, 'Failed to fetch quiz session result');
  }
}
