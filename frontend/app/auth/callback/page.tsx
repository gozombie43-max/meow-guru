'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/axios';

function CallbackContent() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (token) {
      login(token)
        .then(() => router.push('/'))
        .catch(async () => {
          try {
            const { data } = await api.post('/auth/refresh');
            await login(data.token);
            router.push('/');
          } catch {
            router.push('/login');
          }
        });
    } else {
      api.post('/auth/refresh')
        .then(({ data }) => login(data.token))
        .then(() => router.push('/'))
        .catch(() => router.push('/login'));
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}