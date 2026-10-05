"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";

import {
  useAuth,
} from "@/context/AuthContext";

import {
  getSocket,
} from "@/lib/socket";

import {
  fetchUnreadNotificationCount,
} from "@/lib/api/notificationApi";

interface NotificationCenterContextValue {
  unreadCount: number;

  refreshUnreadCount:
    () => Promise<void>;

  decrementUnread:
    () => void;

  clearUnread:
    () => void;
}

const NotificationCenterContext =
  createContext<NotificationCenterContextValue>({
    unreadCount: 0,

    refreshUnreadCount:
      async () => {},

    decrementUnread:
      () => {},

    clearUnread:
      () => {},
  });

export function NotificationCenterProvider({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const {
    user,
    token,
    loading,
  } =
    useAuth();

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const activeUser = useRef(user?.id);
  const pending = useRef<{ owner: string; promise: Promise<void> } | null>(null);
  const badgeRevision = useRef(0);
  useEffect(() => { activeUser.current = user?.id; badgeRevision.current++; }, [user?.id]);
  const refreshUnreadCount = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }
    const owner = user.id;
    if (pending.current?.owner === owner) return pending.current.promise;
    const revision = badgeRevision.current;
    const promise = (async () => {
      try {
        const count = await fetchUnreadNotificationCount();
        if (activeUser.current === owner && revision === badgeRevision.current) setUnreadCount(Math.max(0, count));
      } catch { /* Badge refresh is best effort; polling will retry. */ }
    })();
    const entry = { owner, promise };
    pending.current = entry;
    try { await promise; } finally { if (pending.current === entry) pending.current = null; }
  }, [user]);

  const decrementUnread =
    useCallback(
      () => {
        badgeRevision.current++;
        setUnreadCount(
          (current) =>
            Math.max(
              0,
              current - 1
            )
        );
      },
      []
    );

  const clearUnread =
    useCallback(
      () => {
        badgeRevision.current++;
        setUnreadCount(
          0
        );
      },
      []
    );

  useEffect(() => {
    if (
      loading ||
      !user
    ) {
      if (!loading) {
        const timer = window.setTimeout(() => setUnreadCount(0), 0);
        return () => window.clearTimeout(timer);
      }

      return;
    }

    const initialTimer = window.setTimeout(() => void refreshUnreadCount(), 0);

    const socket =
      getSocket(
        token ||
        undefined
      );

    const handleNewNotification =
      () => {
        /*
         * Query the server instead of
         * blindly incrementing.
         *
         * This avoids race conditions
         * with read-all or duplicates.
         */
        void refreshUnreadCount();
      };

    socket.on(
      "notification:new",
      handleNewNotification
    );

    /*
     * REST safety net:
     * catches events produced on another
     * Azure instance when Socket.IO has
     * no distributed adapter yet.
     */
    let stopped = false;
    let pollTimer: number | undefined;
    const schedulePoll = () => {
      window.clearTimeout(pollTimer);
      if (stopped || document.visibilityState !== 'visible') return;
      pollTimer = window.setTimeout(async () => {
        if (document.visibilityState === 'visible') await refreshUnreadCount();
        schedulePoll();
      }, 60_000 + Math.floor(Math.random() * 60_000));
    };
    schedulePoll();

    const handleFocus =
      () => {
        void refreshUnreadCount();
      };

    const handleVisibility =
      () => {
        schedulePoll();
        if (
          document
            .visibilityState ===
          "visible"
        ) {
          void refreshUnreadCount();
        }
      };

    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      stopped = true;
      window.clearTimeout(initialTimer);
      socket.off(
        "notification:new",
        handleNewNotification
      );

      window.clearTimeout(pollTimer);

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    loading,
    user,
    token,
    refreshUnreadCount,
  ]);

  const value =
    useMemo(
      () => ({
        unreadCount,
        refreshUnreadCount,
        decrementUnread,
        clearUnread,
      }),
      [
        unreadCount,
        refreshUnreadCount,
        decrementUnread,
        clearUnread,
      ]
    );

  return (
    <NotificationCenterContext.Provider
      value={value}
    >
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  return useContext(
    NotificationCenterContext
  );
}
