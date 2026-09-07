"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  useAuth,
} from "@/context/AuthContext";

import {
  trackNotificationEngagement,
} from "@/lib/api/notificationApi";

interface PendingPushOpen {
  notificationId: string;
  route?: string;
  event?: "opened" | "action_clicked";
  tappedAt?: number;
}

const STORAGE_KEY = "meow_push_open_queue";

function readQueue(): PendingPushOpen[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is PendingPushOpen =>
        Boolean(
          item &&
          typeof item.notificationId === "string"
        )
    );
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingPushOpen[]) {
  if (queue.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(queue.slice(-20))
  );
}

export default function PushOpenAnalyticsBridge() {
  const {
    user,
    loading,
  } = useAuth();

  const flushing = useRef(false);

  const flush = useCallback(async () => {
    if (loading || !user || flushing.current) {
      return;
    }

    flushing.current = true;

    try {
      const queue = readQueue();

      if (queue.length === 0) {
        return;
      }

      const remaining: PendingPushOpen[] = [];

      for (const item of queue) {
        try {
          const event =
            item.event === "action_clicked"
              ? "action_clicked"
              : "opened";

          /* A native action click also navigates into the app. */
          if (event === "action_clicked") {
            await trackNotificationEngagement(
              item.notificationId,
              "opened",
              "push"
            );
          }

          await trackNotificationEngagement(
            item.notificationId,
            event,
            "push"
          );
        } catch (error: unknown) {
          const status = (
            error as {
              response?: {
                status?: number;
              };
            }
          )?.response?.status;

          /* Drop events invalid for the active user; retry network and 5xx. */
          if (status === undefined || status >= 500) {
            remaining.push(item);
          }
        }
      }

      saveQueue(remaining);
    } finally {
      flushing.current = false;
    }
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    void flush();

    const handlePushOpen = () => {
      void flush();
    };

    window.addEventListener("meow-push-open", handlePushOpen);

    return () => {
      window.removeEventListener("meow-push-open", handlePushOpen);
    };
  }, [loading, user, flush]);

  return null;
}
