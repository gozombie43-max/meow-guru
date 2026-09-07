import api from "@/lib/axios";

export interface UserNotification {
  _id: string;

  title: string;
  body: string;

  route?: string;

  type?: string;
  category?: string;

  audience?: "all" | "user";
  userId?: string;

  data?: Record<
    string,
    unknown
  >;

  read: boolean;

  createdAt: string;
  expiresAt?: string;
}

export interface NotificationInboxResponse {
  items:
    UserNotification[];

  unreadCount:
    number;

  page:
    number;

  limit:
    number;

  total:
    number;

  totalPages:
    number;
}

export async function fetchNotifications(
  page = 1
): Promise<NotificationInboxResponse> {
  const { data } =
    await api.get(
      `/api/notifications/inbox?page=${page}&limit=20`
    );

  return data;
}

export async function markNotificationRead(
  id: string
) {
  await api.post(
    `/api/notifications/inbox/${id}/read`
  );
}
export async function markAllNotificationsRead() {
  await api.post(
    "/api/notifications/inbox/read-all"
  );
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { data } =
    await api.get(
      "/api/notifications/inbox/unread-count"
    );

  return (
    data.unreadCount ??
    0
  );
}

export type NotificationEngagementEvent =
  | "opened"
  | "action_clicked";

export async function trackNotificationEngagement(
  notificationId: string,
  event:
    NotificationEngagementEvent,
  source:
    "in_app" | "push" =
      "in_app"
) {
  await api.post(
    `/api/notifications/inbox/${notificationId}/engagement`,
    {
      event,
      source,
    }
  );
}
