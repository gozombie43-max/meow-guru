'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, CircleAlert, LoaderCircle } from 'lucide-react';

import api from '@/shared/api/client';

type VerifyState =
  | 'verifying'
  | 'success'
  | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();

  const [status, setStatus] =
    useState<VerifyState>('verifying');

  const [message, setMessage] =
    useState('Verifying your email…');

  // Prevent duplicate requests in React development mode.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;

    startedRef.current = true;

    const token =
      searchParams.get('token')?.trim() || '';

    // Preserve Next.js history state while removing the secret, including
    // malformed tokens, before making any network request.
    window.history.replaceState(window.history.state, '', '/verify-email');

    if (!token || token.length > 256) {
      queueMicrotask(() => {
        setStatus('error');
        setMessage('This verification link is invalid.');
      });
      return;
    }

    async function verify() {
      try {
        await api.post('/auth/verify-email', {
          token,
        });

        setStatus('success');
        setMessage(
          'Your email has been verified successfully.'
        );
      } catch (error: unknown) {
        const apiMessage =
          (
            error as {
              response?: {
                data?: {
                  error?: string;
                };
              };
            }
          )?.response?.data?.error;

        setStatus('error');

        setMessage(
          (typeof apiMessage === 'string' && apiMessage) ||
            'This verification link is invalid or has expired.'
        );
      }
    }

    void verify();
  }, [searchParams]);

  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-10">
      <section className="w-full max-w-md rounded-[24px] border border-black/10 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#111722]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
          {status === 'verifying' && (
            <LoaderCircle
              size={28}
              className="animate-spin"
              aria-hidden="true"
            />
          )}

          {status === 'success' && (
            <CheckCircle2
              size={28}
              aria-hidden="true"
            />
          )}

          {status === 'error' && (
            <CircleAlert
              size={28}
              aria-hidden="true"
            />
          )}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          {status === 'verifying'
            ? 'Verifying email'
            : status === 'success'
              ? 'Email verified'
              : 'Verification failed'}
        </h1>

        <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 opacity-70">
          {message}
        </p>

        {status === 'success' && (
          <Link
            href="/login"
            className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white dark:bg-white dark:text-black"
          >
            Continue to sign in
          </Link>
        )}

        {status === 'error' && (
          <Link
            href="/login"
            className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-semibold text-white dark:bg-white dark:text-black"
          >
            Back to sign in
          </Link>
        )}
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main role="status" aria-label="Loading email verification" className="min-h-dvh flex items-center justify-center">
          <LoaderCircle
            size={28}
            className="animate-spin"
            aria-hidden="true"
          />
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
