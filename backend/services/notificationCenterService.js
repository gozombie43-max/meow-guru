import {
  getNotificationFeedCollection,
} from "../config/mongodb.js";
import {
  emitNotificationToUser,
  emitGlobalNotification,
} from "./notificationRealtime.js";

const RETENTION_DAYS = 30;

function getExpiryDate() {
  return new Date(
    Date.now() +
      RETENTION_DAYS *
        24 *
        60 *
        60 *
        1000
  );
}

async function insertNotification({
  audience,
  userId = null,
  title,
  body,
  route = "/",
  category = "announcements",
  type = "notification",
  data = {},
  dedupeKey = null,
}) {
  const collection =
    getNotificationFeedCollection();

  const doc = {
    audience,

    ...(userId
      ? {
          userId:
            String(userId),
        }
      : {}),

    title,
    body,
    route,

    category,
    type,

    data,

    createdAt:
      new Date(),

    expiresAt:
      getExpiryDate(),
  };

  if (dedupeKey) {
    doc.dedupeKey =
      String(dedupeKey);
  }

  try {
    const result =
      await collection.insertOne(
        doc
      );

    const notification = {
      _id:
        String(
          result.insertedId
        ),

      title:
        doc.title,

      body:
        doc.body,

      route:
        doc.route,

      category:
        doc.category,

      type:
        doc.type,

      data:
        doc.data,

      createdAt:
        doc.createdAt,

      read:
        false,
    };

    if (
      audience === "user"
    ) {
      emitNotificationToUser(
        userId,
        notification
      );
    } else if (
      audience === "all"
    ) {
      emitGlobalNotification(
        notification
      );
    }

    return result.insertedId;

  } catch (error) {
    /*
     * Duplicate notification:
     * return existing ID instead of
     * creating another inbox entry.
     */
    if (
      error?.code === 11000 &&
      dedupeKey
    ) {
      const existing =
        await collection.findOne(
          {
            dedupeKey:
              String(
                dedupeKey
              ),
          },
          {
            projection: {
              _id: 1,
            },
          }
        );

      return (
        existing?._id ??
        null
      );
    }

    throw error;
  }
}

export function createUserNotification({
  userId,
  ...notification
}) {
  return insertNotification({
    audience: "user",
    userId,
    ...notification,
  });
}

export function createGlobalNotification(
  notification
) {
  return insertNotification({
    audience: "all",
    ...notification,
  });
}
