import express from "express";
import { protect } from "../middleware/protect.js";
import { requireRole } from "../middleware/requireRole.js";
import { battleReadLimiter } from "../middleware/battleRateLimits.js";
import * as controller from "../controllers/battleController.js";

const router = express.Router();

router.get("/capabilities", protect, battleReadLimiter, controller.getCapabilities);
router.get("/missions", protect, controller.getMissions);
router.post("/missions/:id/claim", protect, controller.claimMission);
router.get("/admin/analytics/competitive-health", protect, requireRole("admin", "superadmin"), controller.getCompetitiveHealth);
router.get("/season/reward-track", protect, controller.getSeasonRewardTrackHandler);
router.post("/season/reward-track/:level/claim", protect, controller.claimSeasonRewardHandler);
router.get("/cosmetics", protect, controller.getCosmetics);
router.put("/cosmetics/equip", protect, controller.equipCosmetic);
router.get("/profile", protect, controller.getProfile);
router.get("/players/:userId/summary", protect, controller.getPlayerSummary);
router.get("/social", protect, controller.getSocial);
router.post("/social/friends/:userId", protect, controller.sendFriendRequestRoute);
router.post("/social/friends/:userId/respond", protect, controller.respondFriendRequestRoute);
router.delete("/social/friends/:userId", protect, controller.removeFriendRoute);
router.put("/social/favorites/:userId", protect, controller.setFavoriteRoute);
router.get("/players/:userId/rivalry", protect, controller.getPlayerRivalryRoute);
router.post("/admin/seasons", protect, requireRole("admin", "superadmin"), controller.createSeason);
router.get("/season/current", protect, controller.getCurrentSeason);
router.get("/season/me", protect, controller.getMySeason);
router.get("/season/leaderboard", protect, controller.getSeasonLeaderboardRoute);
router.get("/season/rewards", protect, controller.getSeasonRewardsListRoute);
router.get("/leaderboard", protect, controller.getLeaderboardRoute);
router.get("/admin/integrity/summary", protect, requireRole("admin", "superadmin"), controller.getIntegritySummary);
router.get("/admin/integrity/events", protect, requireRole("admin", "superadmin"), controller.getIntegrityEventsList);
router.patch("/admin/integrity/events/:id", protect, requireRole("admin", "superadmin"), controller.updateIntegrityEvent);

export default router;
