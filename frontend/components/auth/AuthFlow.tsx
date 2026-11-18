'use client';
import type { z } from 'zod';
import type { loginSchema } from '@meow/contracts/auth';

import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight, Lock, Mail } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import api from '@/shared/api/client';
import AuthCard from '@/components/auth/AuthCard';
import AuthInput from '@/components/auth/AuthInput';
import EmailOtpLogin from '@/components/auth/EmailOtpLogin';
import { emailPattern } from '@/components/auth/validation';
import { signInErrorMessage } from '@/components/auth/signInError';
import styles from '@/components/auth/auth.module.css';

const ForgotPasswordModal = dynamic(() => import('@/components/auth/ForgotPasswordModal'), { ssr: false });

type FormData = { email: string; password: string };

interface AuthFlowProps {
  mode: 'login' | 'signup';
  embedded?: boolean;
  /** Embedded only: 'tabs' shows a segmented switch, 'link' shows a single text link under the form. */
  modeSwitch?: 'tabs' | 'link';
  onCancel?: () => void;
  onSuccess?: () => void;
}

/**
 * One-page sign in / create account. Both use an emailed 6-digit code entered in place.
 * Existing password accounts can still sign in through the secondary "Log in with password" link.
 */
export default function AuthFlow({ mode, embedded = false, modeSwitch = 'tabs', onCancel, onSuccess }: AuthFlowProps) {
  const { login } = useAuth();
  const router = useRouter();
  const [currentMode, setCurrentMode] = useState<'login' | 'signup'>(mode);
  const [error, setError] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const activeMode = embedded ? currentMode : mode;
  const signup = activeMode === 'signup';
  const title = signup ? 'Create account' : 'Welcome back';
  const subtitle = signup ? '1-day free trial' : 'Sign in to continue';

  const { register, handleSubmit, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { email: '', password: '' },
  });
  const email = useWatch({ control, name: 'email' });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('meow_remember_email');
      if (saved) setValue('email', saved);
    } catch { /* ignore */ }
  }, [setValue]);

  const completeSignIn = async (token: string, signedInEmail: string) => {
    try { localStorage.setItem('meow_remember_email', signedInEmail); } catch { /* ignore */ }
    await login(token);
    onSuccess?.();
    if (!embedded) {
      const params = new URLSearchParams(window.location.search);
      const raw = (params.get('redirect') || params.get('next') || '').trim();
      const safe = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/';
      router.replace(safe);
    }
  };

  const onPasswordSubmit = async (data: FormData) => {
    setError('');
    try {
      const res = await api.post('/auth/login', { email: data.email, password: data.password } satisfies z.input<typeof loginSchema>);
      await completeSignIn(res.data.token, data.email);
    } catch (err: unknown) {
      setError(signInErrorMessage(err));
    }
  };

  const switchEmbeddedMode = (nextMode: 'login' | 'signup') => {
    setCurrentMode(nextMode);
    setUsePassword(false);
    setError('');
  };

  const formContent = (
    <>
      {usePassword && !signup ? (
        <form onSubmit={handleSubmit(onPasswordSubmit)} className={styles.form} noValidate>
          <AuthInput id="login-email" label="Email" type="email" autoComplete="email" placeholder="name@example.com"
            icon={<Mail size={17} />} error={errors.email?.message}
            {...register('email', { required: 'Email is required', pattern: { value: emailPattern, message: 'Please enter a valid email address' } })} />
          <AuthInput id="login-password" label="Password" type="password" isPassword autoComplete="current-password"
            placeholder="Your password" icon={<Lock size={17} />} error={errors.password?.message}
            {...register('password', { required: 'Password is required' })} />
          <div className={styles.optionsRow}>
            <button type="button" className={styles.forgotBtn} onClick={() => setForgotOpen(true)}>Forgot password?</button>
          </div>
          <button data-ui-button="primary" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}
            className={styles.primaryBtn} aria-label="Sign in">
            <span>Sign In</span>
            {isSubmitting ? <span className={styles.spinner} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>
      ) : (
        <EmailOtpLogin mode={activeMode} email={email} onEmailChange={value => setValue('email', value)} onSuccess={completeSignIn} />
      )}

      {!signup && (
        <div className={styles.cardFooter}>
          <button type="button" className={styles.forgotBtn} onClick={() => { setUsePassword(value => !value); setError(''); }}>
            {usePassword ? 'Log in with email code' : 'Log in with password'}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {embedded ? (
        <div className={styles.embeddedAuth} aria-label={title}>
          <div className={styles.embeddedHeader}>
            <div className={styles.embeddedHeaderText}>
              <h2 className={styles.brandTitle}>{title}</h2>
              <p className={styles.brandSubtitle}>{subtitle}</p>
            </div>
            {onCancel && (
              <button
                type="button"
                className={styles.embeddedBackBtn}
                onClick={onCancel}
                aria-label="Back"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span>Back</span>
              </button>
            )}
          </div>

          {modeSwitch === 'tabs' && (
            <div className={styles.loginMethods} role="group" aria-label="Authentication mode">
              <button
                type="button"
                aria-pressed={activeMode === 'login'}
                className={`${styles.segmentedTab} ${activeMode === 'login' ? styles.segmentedTabActive : ''}`}
                onClick={() => switchEmbeddedMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                aria-pressed={activeMode === 'signup'}
                className={`${styles.segmentedTab} ${activeMode === 'signup' ? styles.segmentedTabActive : ''}`}
                onClick={() => switchEmbeddedMode('signup')}
              >
                Create Account
              </button>
            </div>
          )}

          {error && (
            <div className={styles.alertBanner} role="alert">
              <AlertCircle size={16} />
              <div>{error}</div>
            </div>
          )}

          {formContent}

          {modeSwitch === 'link' && (
            <p className={styles.modeSwitchText}>
              {signup ? 'Already have an account?' : 'New to Meow?'}{' '}
              <button
                type="button"
                className={styles.modeSwitchLink}
                onClick={() => switchEmbeddedMode(signup ? 'login' : 'signup')}
              >
                {signup ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          )}
        </div>
      ) : (
        <AuthCard
          title={title}
          subtitle={subtitle}
          activeTab={signup ? 'register' : 'login'}
          error={error}
        >
          {formContent}
        </AuthCard>
      )}
      {forgotOpen && <ForgotPasswordModal isOpen={forgotOpen} onClose={() => setForgotOpen(false)} />}
    </>
  );
}
