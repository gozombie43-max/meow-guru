'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useMutation, useQuery } from 'convex/react';
import usePresence, { type PresenceState } from '@convex-dev/presence/react';

import { api } from '@/convex/_generated/api';
import { useAuth } from '@/context/AuthContext';

const GLOBAL_ROOM_ID = 'meow-global-v1';
const HEARTBEAT_INTERVAL_MS = 15_000;

const presenceFeatureEnabled =
  process.env.NEXT_PUBLIC_STUDENT_PRESENCE_ENABLED === 'true' &&
  process.env.NEXT_PUBLIC_CONVEX_AUTH_ENABLED === 'true' &&
  Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

interface OnlineSummary {
  count: number;
  capped: boolean;
}

interface StudentPresenceContextValue {
  enabled: boolean;
  currentUserId: string | null;
  users: PresenceState[];
  onlineSummary: OnlineSummary | null;
}

const EMPTY_PRESENCE: StudentPresenceContextValue = {
  enabled: false,
  currentUserId: null,
  users: [],
  onlineSummary: null,
};

const StudentPresenceContext = createContext<StudentPresenceContextValue>(
  EMPTY_PRESENCE,
);

export function useStudentPresence() {
  return useContext(StudentPresenceContext);
}

export function StudentPresenceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, token, loading } = useAuth();

  if (
    !presenceFeatureEnabled ||
    loading ||
    !user?.id ||
    !token
  ) {
    return (
      <StudentPresenceContext.Provider value={EMPTY_PRESENCE}>
        {children}
      </StudentPresenceContext.Provider>
    );
  }

  return (
    <ActiveStudentPresenceProvider key={user.id} userId={user.id}>
      {children}
    </ActiveStudentPresenceProvider>
  );
}

function ActiveStudentPresenceProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const users = usePresence(
    api.presence,
    GLOBAL_ROOM_ID,
    userId,
    HEARTBEAT_INTERVAL_MS,
  );
  const onlineSummary = useQuery(api.presence.onlineCount, {});
  const syncMyProfile = useMutation(api.presence.syncMyProfile);
  const profileSyncRequested = useRef(false);

  const ownPresence = users?.find((entry) => entry.userId === userId);
  const ownData = ownPresence?.data;
  const hasDisplayName =
    typeof ownData === 'object' &&
    ownData !== null &&
    'displayName' in ownData &&
    typeof ownData.displayName === 'string' &&
    ownData.displayName.length > 0;

  useEffect(() => {
    if (!ownPresence || hasDisplayName || profileSyncRequested.current) {
      return;
    }

    profileSyncRequested.current = true;
    void syncMyProfile({}).catch(() => {
      profileSyncRequested.current = false;
    });
  }, [hasDisplayName, ownPresence, syncMyProfile]);

  const value = useMemo<StudentPresenceContextValue>(
    () => ({
      enabled: true,
      currentUserId: userId,
      users: users ?? [],
      onlineSummary: onlineSummary ?? null,
    }),
    [onlineSummary, userId, users],
  );

  return (
    <StudentPresenceContext.Provider value={value}>
      {children}
    </StudentPresenceContext.Provider>
  );
}
