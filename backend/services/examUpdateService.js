import {
  getExamUpdatesCollection,
} from "../config/mongodb.js";

import {
  sendPushToAllUsers,
} from "./pushNotificationService.js";

export async function publishExamUpdate({
  examSlug,
  type,
  title,
  message,
  route,
  sourceUrl = null,
  createdByUserId = null,
  createdByEmail = null,
}) {
  const updates =
    getExamUpdatesCollection();

  const updateKey = [
    examSlug,
    type,
    title,
  ]
    .map((value) =>
      String(value)
        .trim()
        .toLowerCase()
    )
    .join(":");

  const now =
    new Date();

  try {
    await updates.insertOne({
      updateKey,

      examSlug,
      type,

      title,
      message,

      route:
        route ||
        `/exam-updates/${examSlug}`,

      sourceUrl,

      status:
        "publishing",

      createdByUserId,
      createdByEmail,

      createdAt:
        now,

      publishedAt:
        now,
    });

  } catch (error) {
    if (
      error?.code === 11000
    ) {
      return {
        duplicate: true,
        sent: false,
      };
    }

    throw error;
  }

  try {
    const result =
      await sendPushToAllUsers({
        title,

        body:
          message,

        route:
          route ||
          `/exam-updates/${examSlug}`,

        category:
          "examUpdates",

        data: {
          type:
            "exam_update",

          examSlug:
            String(examSlug),

          updateType:
            String(type),
        },

        centerKey:
          `exam-update:${updateKey}`,
      });

    await updates.updateOne(
      {
        updateKey,
      },
      {
        $set: {
          status:
            "sent",

          notificationResult: {
            totalDevices:
              result.totalDevices ?? 0,

            successCount:
              result.successCount ?? 0,

            failureCount:
              result.failureCount ?? 0,

            invalidDeviceCount:
              result.invalidDeviceCount ?? 0,
          },
        },
      }
    );

    return {
      sent: true,
      ...result,
    };

  } catch (error) {
    await updates.updateOne(
      {
        updateKey,
      },
      {
        $set: {
          status:
            "failed",

          error:
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

    throw error;
  }
}
