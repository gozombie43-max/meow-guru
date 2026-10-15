'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MailCheck,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';

import api from '@/shared/api/client';
import { emailPattern } from '@/components/auth/validation';
import styles from '@/components/auth/auth.module.css';

const RESEND_COOLDOWN_SECONDS = 60;

function maskEmail(email: string) {
  const [local, domain] = email.split('@');

  if (!local || !domain) {
    return 'your email address';
  }

  const visible =
    local.length <= 2
      ? local[0] || '*'
      : local.slice(0, 2);

  return `${visible}${'*'.repeat(
    Math.max(3, local.length - visible.length)
  )}@${domain}`;
}

export default function CheckEmailPage() {
  const [email, setEmail] = useState('');
  const [seconds, setSeconds] =
    useState(RESEND_COOLDOWN_SECONDS);
  const [cooldownUntil, setCooldownUntil] = useState(() => Date.now() + RESEND_COOLDOWN_SECONDS * 1000);

  const [sending, setSending] =
    useState(false);

  const [message, setMessage] =
    useState('');

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const storedEmail = sessionStorage.getItem('pendingVerificationEmail')?.trim().toLowerCase() || '';
        if (storedEmail.length <= 254 && emailPattern.test(storedEmail)) setEmail(storedEmail);
      } catch {
        // Show generic instructions when browser storage is unavailable.
      }
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldownUntil]);

  async function handleResend() {
    if (
      !email ||
      sending ||
      seconds > 0
    ) {
      return;
    }

    setSending(true);
    setMessage('');

    try {
      await api.post(
        '/auth/resend-verification',
        {
          email,
        }
      );

      setMessage(
        'If the account is still awaiting verification, a new link has been sent.'
      );

      setSeconds(
        RESEND_COOLDOWN_SECONDS
      );
      setCooldownUntil(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
    } catch {
      setMessage(
        'Unable to request another email right now. Please try again shortly.'
      );
    } finally {
      setSending(false);
    }
  }

  const maskedEmail =
    email
      ? maskEmail(email)
      : 'your email address';

  return (
    <main className={styles.authContainer}>
      <section className="w-full max-w-md rounded-[24px] border border-black/10 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#111722]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
          <MailCheck
            size={28}
            aria-hidden="true"
          />
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Check your email
        </h1>

        <p className="mt-3 text-sm leading-6 opacity-70">
          We sent a verification link to
        </p>

        <p className="mt-1 break-words font-medium">
          {maskedEmail}
        </p>

        {!email && <p className="mt-3 text-sm opacity-70">Return to sign in or open this screen after registering to request another link.</p>}

        <p className="mt-4 text-sm leading-6 opacity-60">
          Open the email and tap
          <strong> Verify email</strong>.
          The verification link expires in
          30 minutes.
        </p>

        {message && (
          <div
            className="mt-5 rounded-xl bg-black/[0.04] px-4 py-3 text-sm dark:bg-white/[0.06]"
            role="status"
          >
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={
            !email ||
            sending ||
            seconds > 0
          }
          className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black"
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={
              sending
                ? 'animate-spin'
                : ''
            }
          />

          {sending
            ? 'Sending…'
            : seconds > 0
              ? `Resend in ${seconds}s`
              : 'Resend verification email'}
        </button>

        <Link
          href="/login"
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 text-sm font-medium opacity-70 hover:opacity-100"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
