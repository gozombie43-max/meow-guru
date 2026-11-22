import express from 'express';
import {
  createQuizSessionBodySchema,
  getSessionQuestionsQuerySchema,
  quizSessionIdParamsSchema,
  submitSessionAnswerBodySchema,
  submitSessionBodySchema,
} from '../../../contracts/quiz-session.js';
import { protect } from '../../middleware/protect.js';
import { idempotency } from '../../middleware/idempotency.js';
import { questionReadLimiter } from '../../middleware/rateLimiter.js';
import { validateBody, validateParams } from '../../middleware/validation.js';
import {
  createSessionHandler,
  getSessionHandler,
  getSessionQuestionsHandler,
  getSessionResultHandler,
  submitSessionAnswerHandler,
  submitSessionHandler,
} from '../../controllers/v1/quizSessionController.js';

function validateQuerySafe(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    Object.defineProperty(req, 'query', {
      value: parsed.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return next();
  };
}

const router = express.Router();

router.use(questionReadLimiter);

router.post(
  '/sessions',
  protect,
  validateBody(createQuizSessionBodySchema),
  idempotency('v1.quiz.session.create'),
  createSessionHandler,
);

router.get(
  '/sessions/:id',
  protect,
  validateParams(quizSessionIdParamsSchema),
  getSessionHandler,
);

router.get(
  '/sessions/:id/questions',
  protect,
  validateParams(quizSessionIdParamsSchema),
  validateQuerySafe(getSessionQuestionsQuerySchema),
  getSessionQuestionsHandler,
);

router.post(
  '/sessions/:id/answers',
  protect,
  validateParams(quizSessionIdParamsSchema),
  validateBody(submitSessionAnswerBodySchema),
  submitSessionAnswerHandler,
);

router.post(
  '/sessions/:id/submit',
  protect,
  validateParams(quizSessionIdParamsSchema),
  validateBody(submitSessionBodySchema),
  idempotency('v1.quiz.session.submit'),
  submitSessionHandler,
);

router.get(
  '/sessions/:id/result',
  protect,
  validateParams(quizSessionIdParamsSchema),
  getSessionResultHandler,
);

export default router;
