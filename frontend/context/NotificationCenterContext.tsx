"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
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

  const refreshUnreadCount =
    useCallback(
      async () => {
        if (!user) {
          setUnreadCount(
            0
          );

          return;
        }

        try {
          const count =
            await fetchUnreadNotificationCount();

          setUnreadCount(
            Math.max(
              0,
              count
            )
          );

        } catch {
          // Badge refresh is
          // best-effort.
        }
      },
      [
        user,
      ]
    );

  const decrementUnread =
    useCallback(
      () => {
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
    const interval =
      window.setInterval(
        () => {
          void refreshUnreadCount();
        },
        30_000
      );

    const handleFocus =
      () => {
        void refreshUnreadCount();
      };

    const handleVisibility =
      () => {
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
      window.clearTimeout(initialTimer);
      socket.off(
        "notification:new",
        handleNewNotification
      );

      window.clearInterval(
        interval
      );

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
