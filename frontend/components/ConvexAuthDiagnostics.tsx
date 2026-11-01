'use client';

import {
  Authenticated,
  Unauthenticated,
  AuthLoading,
  useQuery,
} from 'convex/react';

import { api } from '@/convex/_generated/api';

function IdentityResult() {
  const identity = useQuery(api.auth.whoAmI);

  if (identity === undefined) {
    return <p>Loading authenticated identity...</p>;
  }

  if (identity === null) {
    return <p>Convex did not receive a valid user identity.</p>;
  }

  return (
    <pre className="overflow-auto rounded-lg bg-neutral-900 p-4 text-sm text-white">
      {JSON.stringify(identity, null, 2)}
    </pre>
  );
}

export default function ConvexAuthDiagnostics() {
  return (
    <main className="min-h-screen p-6">
      <h1 className="mb-6 text-xl font-semibold">
        Meow Convex Authentication
      </h1>

      <AuthLoading>
        <p>Waiting for Convex authentication...</p>
      </AuthLoading>

      <Unauthenticated>
        <p>Meow session is not authenticated with Convex.</p>
      </Unauthenticated>

      <Authenticated>
        <IdentityResult />
      </Authenticated>
    </main>
  );
}
