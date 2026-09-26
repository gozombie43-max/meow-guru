'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuthActions } from '@/context/AuthContext';
import api from '@/shared/api/client';
import { API_BASE } from '@/lib/api-base';
import dynamic from 'next/dynamic';
import AuthCard from '@/components/auth/AuthCard';
import AuthInput from '@/components/auth/AuthInput';
import AuthGoogleButton from '@/components/auth/AuthGoogleButton';
import { emailPattern } from '@/components/auth/validation';
import styles from '@/components/auth/auth.module.css';

const ForgotPasswordModal = dynamic(() => import('@/components/auth/ForgotPasswordModal'), { ssr: false });

type LoginFormData = { email: string; password: string };

function OAuthError({ onError }: { onError: (message: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams?.get('error') === 'oauth') {
      onError('Google authentication was cancelled or failed. Please try again or use your email.');
    }
  }, [searchParams, onError]);
  return null;
}

function LoginContent() {
  const { login } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Pre-fill remembered email
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('meow_remember_email');
      if (savedEmail) {
        setValue('email', savedEmail);
      }
    } catch {
      // ignore
    }
  }, [setValue]);

  const handleGoogleLogin = () => {
    // OAuth must leave the Next.js router and follow backend redirects.
    window.location.assign(new URL(`${API_BASE}/auth/google`, window.location.origin).href);
  };

  const onSubmit = async (data: LoginFormData) => {
    setError('');
    try {
      const res = await api.post('/auth/login', {
        email: data.email,
        password: data.password,
      });

      if (rememberMe) {
        try {
          localStorage.setItem('meow_remember_email', data.email);
        } catch {
          // ignore
        }
      } else {
        try {
          localStorage.removeItem('meow_remember_email');
        } catch {
          // ignore
        }
      }

      await login(res.data.token);
      const searchParams = new URLSearchParams(window.location.search);
      const redirectTarget = searchParams.get('redirect') || searchParams.get('next');
      router.replace(redirectTarget || '/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Invalid email or password. Please try again.');
    }
  };

  return (
    <>
      <Suspense fallback={null}><OAuthError onError={setError} /></Suspense>
      <AuthCard
        title="Welcome Back"
        subtitle="Sign in to your Meow account"
        activeTab="login"
        error={error}
        footerText="Don't have an account?"
        footerLinkText="Create one"
        footerLinkHref="/register"
      >
        {/* Google Single Click Sign-In */}
        <AuthGoogleButton
          onClick={handleGoogleLogin}
          text="Continue with Google"
        />

        {/* Apple-style Subtle Divider */}
        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>or</span>
          <div className={styles.dividerLine} />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
          <AuthInput
            id="login-email"
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            icon={<Mail size={17} />}
            error={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: emailPattern, message: 'Please enter a valid email address' },
            })}
          />

          <AuthInput
            id="login-password"
            label="Password"
            type="password"
            isPassword
            autoComplete="current-password"
            placeholder="Your password"
            icon={<Lock size={17} />}
            error={errors.password?.message}
            {...register('password', { required: 'Password is required' })}
          />

          {/* Options: Remember Me & Forgot Password */}
          <div className={styles.optionsRow}>
            <label className={styles.rememberCheckbox}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                aria-label="Remember me"
              />
              <span>Remember me</span>
            </label>

            <button data-ui-button="state"
              type="button"
              className={styles.forgotBtn}
              onClick={() => setForgotOpen(true)}
            >
              Forgot password?
            </button>
          </div>

          {/* iOS Action Button */}
          <button data-ui-button="primary"
            type="submit"
            disabled={isSubmitting}
            className={styles.primaryBtn}
            aria-label="Sign in"
          >
            {isSubmitting ? (
              <span className={styles.spinner} aria-hidden="true" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </AuthCard>

      {/* iOS Modal for Forgot Password */}
      {forgotOpen && <ForgotPasswordModal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />}
    </>
  );
}

export function LoginFallback() {
  return (
    <AuthCard
      title="Welcome Back"
      subtitle="Sign in to your Meow account"
      activeTab="login"
      footerText="Don't have an account?"
      footerLinkText="Create one"
      footerLinkHref="/register"
    >
      {/* Google Single Click Sign-In */}
      <AuthGoogleButton text="Continue with Google" onClick={() => {}} />

      {/* Apple-style Subtle Divider */}
      <div className={styles.divider}>
        <div className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <div className={styles.dividerLine} />
      </div>

      {/* Skeleton Email & Password Form */}
      <div className={styles.form} aria-hidden="true">
        <AuthInput
          id="login-email-skeleton"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          icon={<Mail size={17} />}
          disabled
          readOnly
        />

        <AuthInput
          id="login-password-skeleton"
          label="Password"
          type="password"
          isPassword
          autoComplete="current-password"
          placeholder="Your password"
          icon={<Lock size={17} />}
          disabled
          readOnly
        />

        {/* Options: Remember Me & Forgot Password */}
        <div className={styles.optionsRow}>
          <label className={styles.rememberCheckbox}>
            <input
              type="checkbox"
              defaultChecked
              disabled
              readOnly
              aria-label="Remember me"
            />
            <span>Remember me</span>
          </label>

          <span className={styles.forgotBtn}>
            Forgot password?
          </span>
        </div>

        {/* iOS Action Button */}
        <button data-ui-button="primary"
          type="button"
          disabled
          className={styles.primaryBtn}
          aria-label="Sign in"
        >
          <span>Sign In</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </AuthCard>
  );
}

export default function LoginPage() {
  // OAuthError is already isolated in its own Suspense boundary.
  // Rendering LoginContent directly on the server ensures the full AuthCard,
  // form inputs, and footer exist in initial server HTML (FCP ~1.0s, LCP < 1500ms)
  // without delaying LCP through an outer Suspense boundary fallback.
  return <LoginContent />;
}
