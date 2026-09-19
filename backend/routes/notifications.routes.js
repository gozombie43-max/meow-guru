import express from "express";
import { protect } from "../middleware/protect.js";
import { requireRole } from "../middleware/requireRole.js";
import * as notificationController from "../controllers/notificationController.js";

const router = express.Router();

router.get("/health", protect, requireRole("admin", "superadmin"), notificationController.getHealth);
router.post("/register", protect, notificationController.registerPush);
router.post("/unregister", protect, notificationController.unregisterPush);
router.post("/broadcast", protect, requireRole("admin", "superadmin"), notificationController.broadcastPush);
router.get("/history", protect, requireRole("admin", "superadmin"), notificationController.getHistory);
router.post("/schedule", protect, requireRole("admin", "superadmin"), notificationController.scheduleNotification);
router.get("/scheduled", protect, requireRole("admin", "superadmin"), notificationController.getScheduledNotifications);
router.post("/scheduled/:id/cancel", protect, requireRole("admin", "superadmin"), notificationController.cancelScheduledNotificationHandler);
router.post("/scheduled/:id/retry", protect, requireRole("admin", "superadmin"), notificationController.retryScheduledNotification);
router.get("/inbox/unread-count", protect, notificationController.getInboxUnreadCountHandler);
router.get("/inbox", protect, notificationController.getInboxHandler);
router.post("/inbox/:id/read", protect, notificationController.readNotification);
router.post("/inbox/read-all", protect, notificationController.readAllNotifications);
router.post("/inbox/:id/engagement", protect, notificationController.logEngagement);
router.get("/analytics", protect, requireRole("admin", "superadmin"), notificationController.getAnalytics);

export default router;
