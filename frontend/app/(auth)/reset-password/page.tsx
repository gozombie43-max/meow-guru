'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, CircleAlert, Lock } from 'lucide-react';
import api from '@/shared/api/client';
import styles from '@/components/auth/verification.module.css';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const capturedRef = useRef(false);
  const tokenRef = useRef('');
  const requestRef = useRef<AbortController | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenState, setTokenState] = useState<'loading' | 'ready' | 'invalid'>('loading');

  useEffect(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    const token = searchParams.get('token')?.trim() || '';
    const valid = Boolean(token && token.length <= 256);
    tokenRef.current = valid ? token : '';
    window.history.replaceState(window.history.state, '', '/reset-password');
    queueMicrotask(() => setTokenState(valid ? 'ready' : 'invalid'));
  }, [searchParams]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => router.replace('/login'), 2000);
    return () => window.clearTimeout(timer);
  }, [success, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || requestRef.current || success) return;
    setError('');
    if (!tokenRef.current) {
      setError('This password reset link is invalid.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password.length > 128 || new TextEncoder().encode(password).byteLength > 72) {
      setError('Password is too long. Use at most 72 UTF-8 bytes.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token: tokenRef.current, password }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      tokenRef.current = '';
      setPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      setError(typeof message === 'string' && message ? message : 'Unable to reset your password.');
    } finally {
      if (!controller.signal.aborted) {
        requestRef.current = null;
        setSubmitting(false);
      }
    }
  }

  if (tokenState === 'loading') return <Loading />;

  return (
    <main className={styles.screen}>
      <section className={styles.card}>
        <div className={styles.icon}>
          {success ? <CheckCircle2 size={28} aria-hidden="true" /> : <Lock size={26} aria-hidden="true" />}
        </div>
        <h1 className={styles.heading}>{success ? 'Password changed' : 'Create new password'}</h1>
        {success ? (
          <>
            <p role="status" className={styles.copy}>Your password was reset successfully. Sign in again using your new password.</p>
            <Link href="/login" className={styles.primary}>Sign in</Link>
          </>
        ) : (
          <>
            <p className={styles.copy}>Choose a new password for your Meow account.</p>
            {(error || tokenState === 'invalid') && (
              <div role="alert" id="reset-password-error" className={styles.message}>
                <CircleAlert size={17} aria-hidden="true" />{' '}
                {error || 'This password reset link is invalid. Request a new link from sign in.'}
              </div>
            )}
            <form onSubmit={handleSubmit} className={styles.form} aria-describedby={error || tokenState === 'invalid' ? 'reset-password-error' : undefined}>
              <div className={styles.field}>
                <label htmlFor="new-password">New password</label>
                <input id="new-password" aria-label="New password" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={submitting || tokenState !== 'ready'} required className={styles.input} />
              </div>
              <div className={styles.field}>
                <label htmlFor="confirm-password">Confirm password</label>
                <input id="confirm-password" aria-label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={submitting || tokenState !== 'ready'} required className={styles.input} />
              </div>
              <button type="submit" disabled={submitting || tokenState !== 'ready'} className={styles.primary}>{submitting ? 'Updating…' : 'Reset password'}</button>
            </form>
            <Link href="/login" className={styles.secondary}>Back to sign in</Link>
          </>
        )}
      </section>
    </main>
  );
}

function Loading() {
  return <main className={styles.screen}><p role="status" className={styles.copy}>Loading password reset…</p></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<Loading />}><ResetPasswordContent /></Suspense>;
}
