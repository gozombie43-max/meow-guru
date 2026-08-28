'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

function CallbackContent() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? '/' : '/login?error=oauth');
  }, [loading, router, user]);

  return (
    <div className="min-h-dvh flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return <CallbackContent />;
}
