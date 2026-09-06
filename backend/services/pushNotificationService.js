import { firebaseMessaging } from "../config/firebase.js";
import { getPushDevicesCollection } from "../config/mongodb.js";

const INVALID_REGISTRATION_ERRORS = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export async function sendPushToUser(
  userId,
  {
    title,
    body,
    route = "/",
    data = {},
  }
) {
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
    };
  }

  const fids = devices.map((device) => device.fid);

  const result =
    await firebaseMessaging.sendEachForMulticast({
      fids,

      notification: {
        title,
        body,
      },

      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            String(value),
          ])
        ),
        route,
      },

      android: {
        priority: "high",

        notification: {
          channelId: "default_channel_id",
        },
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

  return {
    successCount: result.successCount,
    failureCount: result.failureCount,
    invalidDeviceCount: invalidFids.length,
  };
}
