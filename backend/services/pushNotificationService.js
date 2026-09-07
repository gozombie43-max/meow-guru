import { firebaseMessaging } from "../config/firebase.js";
import {
  getPushDevicesCollection,
  getUsersCollection,
  getNotificationFeedCollection,
} from "../config/mongodb.js";
import {
  createUserNotification,
  createGlobalNotification,
} from "./notificationCenterService.js";

const INVALID_REGISTRATION_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const DEFAULT_NOTIFICATION_PREFERENCES = {
  enabled: true,
  battleInvites: true,
  battleResults: true,
  dailyPractice: true,
  newMocks: true,
  examUpdates: true,
  announcements: true,
};

function getNotificationActionLabel(
  type
) {
  switch (type) {
    case "battle_invite":
    case "battle_rematch":
      return "Join Battle";

    case "battle_result":
      return "View Battle";

    case "new_mock":
    case "new-mock":
      return "Open Mock";

    case "exam_update":
      return "View Update";

    case "daily_practice":
      return "Start Practice";

    case "streak_protection":
      return "Continue";

    default:
      return "Open";
  }
}

function notificationAllowed(
  user,
  category
) {
  const preferences = {
    ...DEFAULT_NOTIFICATION_PREFERENCES,

    ...(user
      ?.notificationPreferences ||
      {}),
  };

  if (!preferences.enabled) {
    return false;
  }

  if (!category) {
    return true;
  }

  return (
    preferences[category] !==
    false
  );
}

export async function sendPushToUser(
  userId,
  {
    title,
    body,
    route = "/",
    data = {},
    category = "announcements",
    center = true,
    centerKey = null,
  }
) {
  const users =
    getUsersCollection();

  const user =
    await users.findOne(
      {
        id: String(userId),
        type: {
          $ne: "email_lock",
        },
      },
      {
        projection: {
          id: 1,
          notificationPreferences: 1,
        },
      }
    );

  if (!user) {
    return {
      successCount: 0,
      failureCount: 0,
      suppressed: true,
    };
  }

  let notificationId = null;

  if (center) {
    try {
      notificationId =
        await createUserNotification({
          userId,
          title,
          body,
          route,
          category,
          type:
            String(
              data.type ||
              category
            ),
          data,
          dedupeKey:
            centerKey,
        });
    } catch (error) {
      console.error(
        "Notification Center persistence failed:",
        error
      );
    }
  }

  if (
    !notificationAllowed(
      user,
      category
    )
  ) {
    if (notificationId) {
      await getNotificationFeedCollection()
        .updateOne(
          {
            _id:
              notificationId,
          },
          {
            $set: {
              pushMetrics: {
                suppressed: true,

                targetDevices: 0,
                acceptedCount: 0,
                failureCount: 0,

                processedAt:
                  new Date(),
              },
            },
          }
        )
        .catch(() => {});
    }

    return {
      successCount: 0,
      failureCount: 0,
      suppressed: true,
      notificationId:
        notificationId
          ? String(notificationId)
          : null,
    };
  }

  const collection = getPushDevicesCollection();

  const devices = await collection
    .find({
      userId,
      enabled: true,
      platform: "android",
    })
    .toArray();

  if (devices.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      noDevices: true,
      notificationId:
        notificationId
          ? String(notificationId)
          : null,
    };
  }

  const fids = devices.map((device) => device.fid);

  const notificationType =
    String(
      data.type ||
      category ||
      "notification"
    );

  const actionLabel =
    getNotificationActionLabel(
      notificationType
    );

  const messageData = {
    ...Object.fromEntries(
      Object.entries(
        data
      ).map(
        ([key, value]) => [
          key,
          String(value),
        ]
      )
    ),

    route:
      String(route),

    type:
      notificationType,

    actionLabel,

    ...(notificationId
      ? {
          notificationId:
            String(
              notificationId
            ),
        }
      : {}),
  };

  const result =
    await firebaseMessaging.sendEachForMulticast({
      fids,

      data: {
        ...messageData,
        title: String(title),
        body: String(body),
      },

      android: {
        priority: "high",
      },
    });

  const invalidFids = [];

  result.responses.forEach((response, index) => {
    if (response.success) {
      return;
    }

    const code = response.error?.code;

    if (
      code &&
      INVALID_REGISTRATION_ERRORS.has(code)
    ) {
      invalidFids.push(fids[index]);
    }
  });

  if (invalidFids.length > 0) {
    await collection.updateMany(
      {
        fid: {
          $in: invalidFids,
        },
      },
      {
        $set: {
          enabled: false,
          disabledAt: new Date(),
        },
      }
    );
  }

  if (notificationId) {
    try {
      await getNotificationFeedCollection()
        .updateOne(
          {
            _id:
              notificationId,
          },
          {
            $set: {
              pushMetrics: {
                targetDevices:
                  fids.length,

                acceptedCount:
                  result.successCount,

                failureCount:
                  result.failureCount,

                invalidDeviceCount:
                  invalidFids.length,

                processedAt:
                  new Date(),
              },
            },
          }
        );
    } catch (error) {
      console.error(
        "Failed to save notification push metrics:",
        error
      );
    }
  }

  return {
    successCount: result.successCount,
    failureCount: result.failureCount,
    invalidDeviceCount: invalidFids.length,
    notificationId:
      notificationId
        ? String(notificationId)
        : null,
  };
}

export async function sendPushToAllUsers({
  title,
  body,
  route = "/",
  data = {},
  category = "announcements",
  center = true,
  centerKey = null,
}) {
  let notificationId = null;

  if (center) {
    try {
      notificationId =
        await createGlobalNotification({
          title,
          body,
          route,
          category,
          type:
            String(
              data.type ||
              category
            ),
          data,
          dedupeKey:
            centerKey,
        });
    } catch (error) {
      console.error(
        "Global Notification Center persistence failed:",
        error
      );
    }
  }

  const collection = getPushDevicesCollection();

  const devices = await collection
    .find({
      enabled: true,
      platform: "android",
    })
    .project({
      fid: 1,
      userId: 1,
    })
    .toArray();

  const userIds = [
    ...new Set(
      devices
        .map(
          (device) =>
            device.userId
        )
        .filter(Boolean)
    ),
  ];

  const users =
    await getUsersCollection()
      .find(
        {
          id: {
            $in:
              userIds,
          },
        },
        {
          projection: {
            id: 1,
            notificationPreferences: 1,
          },
        }
      )
      .toArray();

  const allowedUsers =
    new Set(
      users
        .filter(
          (user) =>
            notificationAllowed(
              user,
              category
            )
        )
        .map(
          (user) =>
            user.id
        )
    );

  const fids = [
    ...new Set(
      devices
        .filter(
          (device) =>
            allowedUsers.has(
              device.userId
            )
        )
        .map(
          (device) =>
            device.fid
        )
        .filter(Boolean)
    ),
  ];

  if (fids.length === 0) {
    return {
      totalDevices: 0,
      successCount: 0,
      failureCount: 0,
      notificationId:
        notificationId
          ? String(notificationId)
          : null,
    };
  }

  let successCount = 0;
  let failureCount = 0;

  const invalidFids = [];

  const notificationType =
    String(
      data.type ||
      category ||
      "notification"
    );

  const actionLabel =
    getNotificationActionLabel(
      notificationType
    );

  const messageData = {
    ...Object.fromEntries(
      Object.entries(data).map(
        ([key, value]) => [
          key,
          String(value),
        ]
      )
    ),
    route:
      String(route),

    type:
      notificationType,

    actionLabel,
    ...(notificationId
      ? {
          notificationId:
            String(
              notificationId
            ),
        }
      : {}),
  };

  // FCM supports maximum 500 targets per multicast request.
  for (let i = 0; i < fids.length; i += 500) {
    const batch = fids.slice(i, i + 500);

    const result =
      await firebaseMessaging.sendEachForMulticast({
        fids: batch,

        data: {
          ...messageData,
          title: String(title),
          body: String(body),
        },

        android: {
          priority: "high",
        },
      });

    successCount += result.successCount;
    failureCount += result.failureCount;

    result.responses.forEach(
      (response, index) => {
        if (response.success) {
          return;
        }

        const code =
          response.error?.code;

        if (
          code ===
            "messaging/registration-token-not-registered" ||
          code ===
            "messaging/invalid-registration-token"
        ) {
          invalidFids.push(
            batch[index]
          );
        }
      }
    );
  }

  if (invalidFids.length > 0) {
    await collection.updateMany(
      {
        fid: {
          $in: invalidFids,
        },
      },
      {
        $set: {
          enabled: false,
          disabledAt: new Date(),
        },
      }
    );
  }

  if (notificationId) {
    await getNotificationFeedCollection()
      .updateOne(
        {
          _id:
            notificationId,
        },
        {
          $set: {
            pushMetrics: {
              targetDevices:
                fids.length,

              acceptedCount:
                successCount,

              failureCount,

              invalidDeviceCount:
                invalidFids.length,

              processedAt:
                new Date(),
            },
          },
        }
      )
      .catch(
        (error) =>
          console.error(
            "Broadcast metric persistence failed:",
            error
          )
      );
  }

  return {
    totalDevices: fids.length,
    successCount,
    failureCount,
    invalidDeviceCount:
      invalidFids.length,
    notificationId:
      notificationId
        ? String(notificationId)
        : null,
  };
}
