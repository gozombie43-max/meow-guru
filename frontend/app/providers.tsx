'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { SWRConfig, useSWRConfig, type Middleware } from 'swr';
import { useAuth } from '@/context/AuthContext';
import StyledJsxRegistry from '@/lib/styled-jsx-registry';
import { isQuestionQuery, subscribeQuestionChanges } from '@/features/quiz/api/questionWrites';

function QuestionInvalidationBridge({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();
  useEffect(() => subscribeQuestionChanges(() => {
    void mutate(isQuestionQuery, undefined, { revalidate: true });
  }), [mutate]);
  return children;
}

const waitForAuth: Middleware = useSWRNext => function useAuthenticatedQuery(key, fetcher, config) {
  const { loading } = useAuth();
  return useSWRNext(loading ? null : key, fetcher, config);
};

function AccountQueries({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const owner = user?.id ?? 'guest';
  const [scope, setScope] = useState(() => ({ owner, ready: !loading, generation: 0 }));
  if (!scope.ready && !loading) {
    // No queries run during bootstrap, so the empty cache can acquire its first
    // owner without remounting the server-rendered page and replaying effects.
    setScope({ owner, ready: true, generation: scope.generation });
  } else if (scope.ready && scope.owner !== owner) {
    // Actual account changes still discard both private cache and page state.
    setScope({ owner, ready: true, generation: scope.generation + 1 });
  }
  return (
    <SWRConfig key={scope.generation} value={{ provider: () => new Map(), shouldRetryOnError: false, use: [waitForAuth] }}>
      <QuestionInvalidationBridge>{children}</QuestionInvalidationBridge>
    </SWRConfig>
  );
}

export default function ApplicationProviders({ children }: { children: ReactNode }) {
  return (
      <StyledJsxRegistry>
        <AccountQueries>{children}</AccountQueries>
      </StyledJsxRegistry>
  );
}
