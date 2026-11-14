'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ConfigurationTemplate, Spinner } from '@/design-system';

function CallbackContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/' : '/login?error=oauth');
  }, [loading, router, user]);

  return (
    <ConfigurationTemplate variant="auth" maxWidth={440} showNavRail={false} showBottomNav={false}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', textAlign: 'center' }}>
        <Spinner size="lg" tone="accent" aria-hidden="true" style={{ marginBottom: 16 }} />
        <p style={{ color: 'var(--meow-text-muted)', fontSize: 14, margin: 0 }}>Signing you in...</p>
      </div>
    </ConfigurationTemplate>
  );
}

export default function AuthCallbackPage() {
  return <CallbackContent />;
}
