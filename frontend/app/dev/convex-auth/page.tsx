import { notFound } from 'next/navigation';
import ConvexAuthDiagnostics from '@/components/ConvexAuthDiagnostics';

export default function ConvexAuthPage() {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.NEXT_PUBLIC_CONVEX_AUTH_ENABLED !== 'true'
  ) {
    notFound();
  }

  return <ConvexAuthDiagnostics />;
}
