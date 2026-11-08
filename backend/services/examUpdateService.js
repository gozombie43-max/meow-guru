import {
  getExamUpdatesCollection,
} from "../config/mongodb.js";

import {
  sendPushToAllUsers,
} from "./pushNotificationService.js";

import {
  isSafeInternalRoute,
  isSafeHttpUrl,
} from "@meow/contracts/notifications";

/**
 * FINDING-06 defense-in-depth: callers other than the HTTP route (scripts,
 * workers) must not be able to persist or push unsafe navigation targets.
 */
function resolveSafeRoute(route, examSlug) {
  if (route !== undefined && route !== null && route !== "") {
    if (!isSafeInternalRoute(route)) {
      const error = new Error("Invalid exam update route");
      error.statusCode = 400;
      throw error;
    }
    return route;
  }
  return `/exam-updates/${encodeURIComponent(String(examSlug))}`;
}

function resolveSafeSourceUrl(sourceUrl) {
  if (sourceUrl === undefined || sourceUrl === null || sourceUrl === "") return null;
  if (!isSafeHttpUrl(sourceUrl)) {
    const error = new Error("Invalid exam update source URL");
    error.statusCode = 400;
    throw error;
  }
  return sourceUrl;
}

export async function publishExamUpdate({
  examSlug,
  type,
  title,
  message,
  route: requestedRoute,
  sourceUrl: requestedSourceUrl = null,
  createdByUserId = null,
  createdByEmail = null,
}) {
  const route =
    resolveSafeRoute(requestedRoute, examSlug);

  const sourceUrl =
    resolveSafeSourceUrl(requestedSourceUrl);

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

      route,

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

        route,

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
