'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/axios';
import { API_BASE } from '@/lib/api-base';
import {
  AuthCard,
  AuthInput,
  AuthGoogleButton,
  ForgotPasswordModal,
} from '@/components/auth';
import styles from '@/components/auth/auth.module.css';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginContent() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);

  // Detect OAuth redirect error
  useEffect(() => {
    if (searchParams?.get('error') === 'oauth') {
      const timer = window.setTimeout(
        () => setError('Google authentication was cancelled or failed. Please try again or use your email.'),
        0,
      );
      return () => window.clearTimeout(timer);
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
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
    window.location.href = `${API_BASE}/auth/google`;
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
      const redirectTarget = searchParams?.get('redirect') || searchParams?.get('next');
      router.push(redirectTarget || '/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Invalid email or password. Please try again.');
    }
  };

  return (
    <>
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
            {...register('email')}
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
            {...register('password')}
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
      <ForgotPasswordModal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
      />
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.authContainer}>
          <div className={styles.spinner} style={{ borderColor: 'rgba(0, 122, 255, 0.3)', borderTopColor: '#007aff' }} />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
