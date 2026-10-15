'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import api from '@/shared/api/client';
import AuthInput from './AuthInput';
import { signInErrorMessage } from './signInError';
import styles from './auth.module.css';

interface EmailOtpLoginProps {
  email: string;
  onEmailChange: (email: string) => void;
  onSuccess: (token: string, email: string) => Promise<void>;
}

export default function EmailOtpLogin({ email, onEmailChange, onSuccess }: EmailOtpLoginProps) {
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const request = useRef<AbortController | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => { if (challengeId) codeInput.current?.focus(); }, [challengeId]);

  const sendCode = async () => {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setPending(true);
    setError('');
    try {
      // Keep shared Zod validation out of the initial sign-in bundle.
      const { requestEmailOtpSchema } = await import('@meow/contracts/auth');
      if (controller.signal.aborted) return;
      const parsed = requestEmailOtpSchema.safeParse({ email });
      if (!parsed.success) { setError('Enter a valid email address.'); return; }
      const { data } = await api.post('/auth/email-otp/request', parsed.data, { signal: controller.signal });
      if (controller.signal.aborted) return;
      onEmailChange(parsed.data.email);
      setChallengeId(data.challengeId);
      setCode('');
      setCooldown(data.retryAfter || 60);
    } catch (failure) {
      if (controller.signal.aborted) return;
      const retryAfter = (failure as { response?: { data?: { retryAfter?: number } } })?.response?.data?.retryAfter;
      if (retryAfter) setCooldown(retryAfter);
      setError(signInErrorMessage(failure));
    } finally { if (!controller.signal.aborted) setPending(false); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    if (!challengeId) { await sendCode(); return; }
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setError('');
    try {
      const { verifyEmailOtpSchema } = await import('@meow/contracts/auth');
      if (controller.signal.aborted) return;
      const parsed = verifyEmailOtpSchema.safeParse({ email, challengeId, code });
      if (!parsed.success) { setError('Enter the 6-digit code from your email.'); return; }
      const { data } = await api.post('/auth/email-otp/verify', parsed.data, { signal: controller.signal });
      if (!controller.signal.aborted) await onSuccess(data.token, parsed.data.email);
    } catch (failure) {
      if (!controller.signal.aborted) setError(signInErrorMessage(failure));
    } finally { if (!controller.signal.aborted) setPending(false); }
  };

  return (
    <form onSubmit={submit} className={styles.form} noValidate>
      {challengeId ? (
        <>
          <div className={styles.otpNotice} role="status">
            <span>Enter the code sent to <strong>{email}</strong>.</span>
            <button type="button" className={styles.forgotBtn} disabled={pending} onClick={() => {
              setChallengeId(''); setCode(''); setError('');
            }}>Change email</button>
          </div>
          <AuthInput id="login-code" ref={codeInput} label="6-digit code" inputMode="numeric"
            autoComplete="one-time-code" placeholder="000000" maxLength={6}
            className={styles.otpInput} icon={<ShieldCheck size={17} />}
            value={code} disabled={pending} aria-describedby="otp-help"
            onChange={event => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} />
          <p id="otp-help" className={styles.otpHelp}>The code expires in 5 minutes. Check your spam folder too.</p>
        </>
      ) : (
        <>
          <AuthInput id="otp-email" label="Email" type="email" autoComplete="email"
            placeholder="you@example.com" icon={<Mail size={17} />} value={email} disabled={pending}
            onChange={event => { onEmailChange(event.target.value); setError(''); }} />
          <p className={styles.otpHelp}>We’ll email you a code. New here? Confirm it to create your account.</p>
        </>
      )}
      {error && <p className={styles.fieldErrorText} role="alert">{error}</p>}
      <button type="submit" className={styles.primaryBtn} data-ui-button="primary" disabled={pending || (!challengeId && cooldown > 0)}>
        {pending ? <><span className={styles.spinner} aria-hidden="true" /> {challengeId ? 'Signing in…' : 'Sending code…'}</>
          : <><span>{challengeId ? 'Verify & sign in' : cooldown ? `Send code in ${cooldown}s` : 'Send code'}</span><ArrowRight size={16} /></>}
      </button>
      {challengeId && <button type="button" className={styles.otpResend} disabled={pending || cooldown > 0}
        onClick={() => void sendCode()}>{cooldown ? `Resend in ${cooldown}s` : 'Resend code'}</button>}
    </form>
  );
}
