import express from 'express';
import { z } from 'zod';
import { idempotency } from '../middleware/idempotency.js';
import { protect } from '../middleware/protect.js';
import { requireRole } from '../middleware/requireRole.js';
import { battleClaimLimiter, battleReadLimiter, battleWriteLimiter } from '../middleware/battleRateLimits.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import * as controller from '../controllers/battleController.js';

const router = express.Router();

const idParamSchema = z.object({ id: z.string().trim().min(1).max(128) });
const userIdParamSchema = z.object({ userId: z.string().trim().min(1).max(128) });
const levelParamSchema = z.object({ level: z.coerce.number().int().min(1).max(500) });

const equipCosmeticBodySchema = z.object({
  cosmeticCode: z.string().trim().min(1).max(100),
});

const respondFriendBodySchema = z.object({
  action: z.enum(['accept', 'decline']),
});

const setFavoriteBodySchema = z.object({
  favorite: z.boolean(),
});

const createSeasonBodySchema = z.object({
  key: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  startsAt: z.union([z.string().trim().min(1), z.number().finite()]),
  endsAt: z.union([z.string().trim().min(1), z.number().finite()]),
});

const updateIntegrityBodySchema = z.object({
  status: z.enum(['reviewed', 'dismissed', 'escalated']),
  note: z.string().max(1000).optional(),
});

const integrityEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.string().trim().max(40).optional(),
  severity: z.string().trim().max(40).optional(),
  userId: z.string().trim().max(128).optional(),
});

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

router.get('/capabilities', battleReadLimiter, protect, controller.getCapabilities);
router.get('/missions', battleReadLimiter, protect, controller.getMissions);
router.post('/missions/:id/claim', battleClaimLimiter, protect, validateParams(idParamSchema), idempotency('battle.mission.claim'), controller.claimMission);
router.get('/admin/analytics/competitive-health', battleReadLimiter, protect, requireRole('admin', 'superadmin'), controller.getCompetitiveHealth);
router.get('/season/reward-track', battleReadLimiter, protect, controller.getSeasonRewardTrackHandler);
router.post('/season/reward-track/:level/claim', battleClaimLimiter, protect, validateParams(levelParamSchema), idempotency('battle.season.claim'), controller.claimSeasonRewardHandler);
router.get('/cosmetics', battleReadLimiter, protect, controller.getCosmetics);
router.put('/cosmetics/equip', battleWriteLimiter, protect, validateBody(equipCosmeticBodySchema), controller.equipCosmetic);
router.get('/profile', battleReadLimiter, protect, controller.getProfile);
router.get('/players/:userId/summary', battleReadLimiter, protect, validateParams(userIdParamSchema), controller.getPlayerSummary);
router.get('/social', battleReadLimiter, protect, controller.getSocial);
router.post('/social/friends/:userId', battleWriteLimiter, protect, validateParams(userIdParamSchema), controller.sendFriendRequestRoute);
router.post('/social/friends/:userId/respond', battleWriteLimiter, protect, validateParams(userIdParamSchema), validateBody(respondFriendBodySchema), controller.respondFriendRequestRoute);
router.delete('/social/friends/:userId', battleWriteLimiter, protect, validateParams(userIdParamSchema), controller.removeFriendRoute);
router.put('/social/favorites/:userId', battleWriteLimiter, protect, validateParams(userIdParamSchema), validateBody(setFavoriteBodySchema), controller.setFavoriteRoute);
router.get('/players/:userId/rivalry', battleReadLimiter, protect, validateParams(userIdParamSchema), controller.getPlayerRivalryRoute);
router.post('/admin/seasons', battleWriteLimiter, protect, requireRole('admin', 'superadmin'), validateBody(createSeasonBodySchema), controller.createSeason);
router.get('/season/current', battleReadLimiter, protect, controller.getCurrentSeason);
router.get('/season/me', battleReadLimiter, protect, controller.getMySeason);
router.get('/season/leaderboard', battleReadLimiter, protect, controller.getSeasonLeaderboardRoute);
router.get('/season/rewards', battleReadLimiter, protect, controller.getSeasonRewardsListRoute);
router.get('/leaderboard', battleReadLimiter, protect, controller.getLeaderboardRoute);
router.get('/admin/integrity/summary', battleReadLimiter, protect, requireRole('admin', 'superadmin'), controller.getIntegritySummary);
router.get('/admin/integrity/events', battleReadLimiter, protect, requireRole('admin', 'superadmin'), validateQuerySafe(integrityEventsQuerySchema), controller.getIntegrityEventsList);
router.patch('/admin/integrity/events/:id', battleWriteLimiter, protect, requireRole('admin', 'superadmin'), validateParams(idParamSchema), validateBody(updateIntegrityBodySchema), controller.updateIntegrityEvent);

export default router;
