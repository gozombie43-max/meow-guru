'use client';

import { useEffect, type ReactNode } from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { isQuestionQuery, subscribeQuestionChanges } from '@/features/quiz/api/questionWrites';

function QuestionInvalidationBridge({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();
  useEffect(() => subscribeQuestionChanges(() => {
    void mutate(isQuestionQuery, undefined, { revalidate: true });
  }), [mutate]);
  return children;
}

function AccountQueries({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <SWRConfig key={user?.id ?? 'guest'} value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <QuestionInvalidationBridge>{children}</QuestionInvalidationBridge>
    </SWRConfig>
  );
}

function FirebaseClientBootstrap() {
  useEffect(() => {
    void import('@/lib/firebase/client');
  }, []);

  return null;
}

export default function ApplicationProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <FirebaseClientBootstrap />
      <AuthProvider>
        <AccountQueries>{children}</AccountQueries>
      </AuthProvider>
    </>
  );
}
