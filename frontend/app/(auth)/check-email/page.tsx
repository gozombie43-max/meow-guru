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
import styles from '@/components/auth/verification.module.css';

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
    <main className={styles.screen}>
      <section className={styles.card}>
        <div className={styles.icon}>
          <MailCheck
            size={28}
            aria-hidden="true"
          />
        </div>

        <h1 className={styles.heading}>
          Check your email
        </h1>

        <p className={styles.copy}>
          We sent a verification link to
        </p>

        <p className={styles.email}>
          {maskedEmail}
        </p>

        {!email && <p className={styles.copy}>Return to sign in or open this screen after registering to request another link.</p>}

        <p className={styles.copy}>
          Open the email and tap
          <strong> Verify email</strong>.
          The verification link expires in
          30 minutes.
        </p>

        {message && (
          <div
            className={styles.message}
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
          className={styles.primary}
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={
              sending
                ? styles.spin
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
          className={styles.secondary}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
