let ioInstance = null;

export function setNotificationRealtimeServer(
  io
) {
  ioInstance = io;
}

export function emitNotificationToUser(
  userId,
  notification
) {
  if (
    !ioInstance ||
    !userId
  ) {
    return;
  }

  ioInstance
    .to(
      `user:${String(userId)}`
    )
    .emit(
      "notification:new",
      notification
    );
}

export function emitGlobalNotification(
  notification
) {
  if (!ioInstance) {
    return;
  }

  ioInstance.emit(
    "notification:new",
    notification
  );
}
