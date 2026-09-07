"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Bell,
  CheckCheck,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  trackNotificationEngagement,
  type UserNotification,
} from "@/lib/api/notificationApi";

import {
  useNotificationCenter,
} from "@/context/NotificationCenterContext";

import {
  getNotificationPresentation,
  getSafeNotificationRoute,
} from "@/lib/notificationPresentation";

export default function NotificationsPage() {
  const router =
    useRouter();

  const {
    decrementUnread,
    clearUnread,
    refreshUnreadCount,
  } =
    useNotificationCenter();

  const [
    items,
    setItems,
  ] =
    useState<
      UserNotification[]
    >([]);

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    openingId,
    setOpeningId,
  ] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    void fetchNotifications()
      .then(
        (data) => {
          setItems(
            data?.items || []
          );

          setUnreadCount(
            data?.unreadCount || 0
          );

          void refreshUnreadCount();
        }
      )
      .catch(() => {
        setItems([]);
        setUnreadCount(0);
      })
      .finally(
        () =>
          setLoading(
            false
          )
      );
  }, [refreshUnreadCount]);

  const openNotification =
    async (
      item:
        UserNotification
    ) => {
      if (
        openingId ===
        item._id
      ) {
        return;
      }

      const safeRoute =
        getSafeNotificationRoute(
          item.route
        );

      if (!safeRoute) {
        return;
      }

      setOpeningId(
        item._id
      );

      try {
        if (!item.read) {
          /*
           * Update UI immediately.
           */
          setItems(
            (current) =>
              current.map(
                (entry) =>
                  entry._id ===
                  item._id
                    ? {
                        ...entry,
                        read:
                          true,
                      }
                    : entry
              )
          );

          setUnreadCount(
            (count) =>
              Math.max(
                0,
                count - 1
              )
          );

          decrementUnread();

          /*
           * Persist read status.
           */
          await markNotificationRead(
            item._id
          ).catch(
            () => {
              void refreshUnreadCount();
            }
          );
        }

        router.push(
          safeRoute
        );

      } finally {
        setOpeningId(
          null
        );
      }
    };

  const markAll =
    async () => {
      await markAllNotificationsRead().catch(() => {});

      clearUnread();

      setItems(
        (current) =>
          current.map(
            (item) => ({
              ...item,
              read: true,
            })
          )
      );

      setUnreadCount(0);
    };

  const handleCardClick =
    (
      item:
        UserNotification
    ) => {
      void trackNotificationEngagement(
        item._id,
        "opened",
        "in_app"
      ).catch(
        () => {}
      );
    };

  const handleNotificationAction =
    (
      item:
        UserNotification
    ) => {
      void trackNotificationEngagement(
        item._id,
        "action_clicked",
        "in_app"
      ).catch(
        () => {}
      );

      void openNotification(
        item
      );
    };

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 py-5 pb-28">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">
            Notifications
          </h1>

          <p className="text-sm opacity-60">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You're all caught up"}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAll}
            className="flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition cursor-pointer"
          >
            <CheckCheck size={17} />
            Read all
          </button>
        )}
      </header>

      {loading ? (
        <div className="py-16 text-center opacity-60">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center">
          <Bell
            className="mx-auto mb-3 opacity-30"
            size={32}
          />

          <p className="font-semibold">
            No notifications yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const {
              label,
              Icon,
            } =
              getNotificationPresentation(
                item.type,
                item.category
              );

            const safeRoute =
              getSafeNotificationRoute(
                item.route
              );

            return (
              <article
                key={item._id}
                onClick={() => handleCardClick(item)}
                className={`rounded-2xl border p-4 ${
                  item.read
                    ? "opacity-70"
                    : "shadow-sm"
                }`}
              >
                <div className="flex gap-3">
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black/5 dark:bg-white/10">
                      <Icon
                        size={19}
                      />
                    </div>

                    {!item.read && (
                      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white dark:ring-black" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">
                      {item.title}
                    </h2>

                    <p className="mt-1 text-sm opacity-70">
                      {item.body}
                    </p>

                    <p className="mt-2 text-xs opacity-45">
                      {new Date(
                        item.createdAt
                      ).toLocaleString()}
                    </p>

                    {safeRoute && (
                      <button
                        type="button"
                        disabled={
                          openingId ===
                          item._id
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotificationAction(
                            item
                          );
                        }}
                        className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
                      >
                        {openingId ===
                        item._id
                          ? "Opening…"
                          : label}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
