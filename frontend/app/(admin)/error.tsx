'use client';

import RouteErrorState from '@/components/RouteErrorState';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteErrorState label="admin dashboard" reset={reset} />;
}
