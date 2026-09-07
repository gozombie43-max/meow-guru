import {
  getMockSlotsCollection,
  getNotificationHistoryCollection,
} from "../config/mongodb.js";

import {
  sendPushToAllUsers,
} from "./pushNotificationService.js";

export async function notifyNewMockPublished({
  id,
  examSlug,
  title,
  tier = null,
  type = "mock",
}) {
  if (
    !id ||
    !examSlug
  ) {
    return {
      skipped: true,
      reason:
        "invalid-slot",
    };
  }

  // Don't send "New Mock" notifications
  // for PYQ uploads.
  if (
    type !== "mock"
  ) {
    return {
      skipped: true,
      reason:
        "not-mock",
    };
  }

  const slots =
    getMockSlotsCollection();

  const now =
    new Date();

  /*
   * Idempotency claim.
   *
   * Even if two publish requests race,
   * only one can claim this mock.
   */
  const claim =
    await slots.updateOne(
      {
        id:
          String(id),

        examSlug:
          String(examSlug),

        newMockNotificationClaimedAt: {
          $exists: false,
        },
      },

      {
        $set: {
          newMockNotificationClaimedAt:
            now,

          newMockNotificationStatus:
            "processing",
        },
      }
    );

  if (
    claim.modifiedCount !== 1
  ) {
    return {
      skipped: true,
      reason:
        "already-notified",
    };
  }

  try {
    const result =
      await sendPushToAllUsers({
        title:
          "New Mock Test 🎯",

        body:
          `${title || "A new mock test"} is now available.`,

        route:
          `/mock-test/${encodeURIComponent(
            examSlug
          )}/${encodeURIComponent(
            id
          )}`,

        category:
          "newMocks",

        data: {
          type:
            "new_mock",

          examSlug:
            String(examSlug),

          testId:
            String(id),

          tier:
            String(
              tier || ""
            ),
        },

        centerKey:
          `new-mock:${examSlug}:${id}`,
      });

    await slots.updateOne(
      {
        id:
          String(id),

        examSlug:
          String(examSlug),
      },

      {
        $set: {
          newMockNotificationStatus:
            "sent",

          newMockNotificationSentAt:
            new Date(),

          newMockNotificationResult: {
            totalDevices:
              result.totalDevices ??
              0,

            successCount:
              result.successCount ??
              0,

            failureCount:
              result.failureCount ??
              0,

            invalidDeviceCount:
              result.invalidDeviceCount ??
              0,
          },
        },
      }
    );

    // Audit history
    try {
      const history =
        getNotificationHistoryCollection();

      await history.insertOne({
        type:
          "new-mock",

        title:
          "New Mock Test 🎯",

        body:
          `${title || "A new mock test"} is now available.`,

        route:
          `/mock-test/${examSlug}/${id}`,

        examSlug:
          String(examSlug),

        testId:
          String(id),

        mockTitle:
          title || null,

        totalDevices:
          result.totalDevices ??
          0,

        successCount:
          result.successCount ??
          0,

        failureCount:
          result.failureCount ??
          0,

        invalidDeviceCount:
          result.invalidDeviceCount ??
          0,

        createdAt:
          new Date(),
      });

    } catch (historyError) {
      console.error(
        "New mock notification history failed:",
        historyError
      );
    }

    return {
      sent: true,
      ...result,
    };

  } catch (error) {
    console.error(
      "Automatic new mock push failed:",
      error
    );

    /*
     * Keep the claim.
     * We prefer a missed notification
     * over accidentally duplicating a
     * mass push after an ambiguous crash.
     */
    await slots.updateOne(
      {
        id:
          String(id),

        examSlug:
          String(examSlug),
      },

      {
        $set: {
          newMockNotificationStatus:
            "failed",

          newMockNotificationFailedAt:
            new Date(),

          newMockNotificationError:
            String(
              error?.message ||
              error
            ).slice(
              0,
              500
            ),
        },
      }
    );

    return {
      sent: false,
      error: true,
    };
  }
}
