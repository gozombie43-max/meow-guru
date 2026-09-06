'use client';

import { useState, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/axios';
import { API_BASE } from '@/lib/api-base';
import styles from './login.module.css';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Zap,
  Brain,
  Swords,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  X
} from 'lucide-react';
import WolfIcon from '@/components/WolfIcon';

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Detect OAuth redirect error
  useEffect(() => {
    if (searchParams?.get('error') === 'oauth') {
      setError('Google authentication was cancelled or could not be completed. Please try again or use your email.');
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

  // Google Login redirect
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
          // ignore localStorage error
        }
      } else {
        try {
          localStorage.removeItem('meow_remember_email');
        } catch {
          // ignore localStorage error
        }
      }

      await login(res.data.token);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Invalid email or password. Please check your credentials and try again.');
    }
  };

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

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes('@')) return;
    setForgotSent(true);
  };

  return (
    <main className={styles.loginPage}>
      {/* Dynamic Ambient Glow & Dot Matrix */}
      <div className={styles.ambientBlob1} aria-hidden="true" />
      <div className={styles.ambientBlob2} aria-hidden="true" />
      <div className={styles.ambientBlob3} aria-hidden="true" />
      <div className={styles.ambientGrid} aria-hidden="true" />

      {/* Main Glass Shell */}
      <div className={styles.shell}>
        {/* Left Showcase Pane (Desktop / Tablet landscape) */}
        <aside className={styles.showcasePane}>
          <div className={styles.showcaseTop}>
            <Link href="/" className={styles.brandLink} aria-label="Go to Meow home">
              <WolfIcon size={36} className={styles.wolfBrandIcon} />
              <div className={styles.brandDetails}>
                <span className={styles.brandName}>Meow</span>
                <span className={styles.brandTagline}>SSC Exam Prep</span>
              </div>
            </Link>

            <div className={styles.heroContent}>
              <div className={styles.versionBadge}>
                <Sparkles size={12} />
                <span>AI Practice Engine v2.5</span>
              </div>
              <h1 className={styles.heroTitle}>
                Study Smarter.<br />
                <span className={styles.heroTitleAccent}>Rank Higher.</span>
              </h1>
              <p className={styles.heroSubtitle}>
                Adaptive PYQ drills, instant question explanations, and live competitive mock tests designed for SSC CGL &amp; CHSL toppers.
              </p>
            </div>

            {/* Feature Cards Stack */}
            <div className={styles.featuresStack}>
              <div className={styles.featureCard}>
                <div className={`${styles.featureIconWrap} ${styles.iconPurple}`}>
                  <Zap size={20} />
                </div>
                <div className={styles.featureMeta}>
                  <span className={styles.featureTitle}>Adaptive Mock Engine</span>
                  <span className={styles.featureDesc}>Calibrates question difficulty in real-time to your accuracy.</span>
                </div>
              </div>

              <div className={styles.featureCard}>
                <div className={`${styles.featureIconWrap} ${styles.iconCyan}`}>
                  <Brain size={20} />
                </div>
                <div className={styles.featureMeta}>
                  <span className={styles.featureTitle}>BrainScan™ Diagnostics</span>
                  <span className={styles.featureDesc}>Deep score forecasts &amp; instant weak-area detection.</span>
                </div>
              </div>

              <div className={styles.featureCard}>
                <div className={`${styles.featureIconWrap} ${styles.iconAmber}`}>
                  <Swords size={20} />
                </div>
                <div className={styles.featureMeta}>
                  <span className={styles.featureTitle}>Live Peer Arena</span>
                  <span className={styles.featureDesc}>Daily 1v1 speed battles with 25,000+ active aspirants.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof & Live Count */}
          <div className={styles.showcaseBottom}>
            <div className={styles.avatarGroup}>
              <div className={styles.avatarItem}>A1</div>
              <div className={styles.avatarItem}>C4</div>
              <div className={styles.avatarItem}>R9</div>
              <span className={styles.socialStat}>45,000+ aspirants enrolled</span>
            </div>

            <div className={styles.liveBadge}>
              <span className={styles.liveDot} />
              <span>1,480 practicing now</span>
            </div>
          </div>
        </aside>

        {/* Right Authentication Pane */}
        <section className={styles.formPane}>
          <div className={styles.formCard}>
            {/* Mobile Brand Bar */}
            <div className={styles.mobileBrandBar}>
              <Link
                href="/"
                className={styles.backHomeBtn}
                aria-label="Return to home page"
              >
                <ArrowLeft size={16} />
                <span>Home</span>
              </Link>

              <Link href="/" className={styles.mobileBrandCenter} aria-label="Go to Meow home">
                <WolfIcon size={32} className={styles.wolfBrandIcon} />
                <span className={styles.brandName} style={{ fontSize: 20 }}>Meow</span>
              </Link>

              <div className={styles.mobileHeaderSpacer} aria-hidden="true" />
            </div>

            {/* Header */}
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>Welcome back 👋</h2>
              <p className={styles.formSubtitle}>Sign in to resume your daily streak &amp; study plan.</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className={styles.alertError} role="alert">
                <AlertCircle size={18} className={styles.alertIcon} />
                <div>{error}</div>
              </div>
            )}

            {/* Google Sign-in */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className={styles.googleBtn}
              aria-label="Continue with Google"
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className={styles.divider}>
              <div className={styles.dividerLine} />
              <span className={styles.dividerText}>or continue with email</span>
              <div className={styles.dividerLine} />
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
              {/* Email */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="login-email">
                  Email address
                </label>
                <div className={styles.inputWrapper}>
                  <Mail size={18} className={styles.inputIcon} aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    className={`${styles.input} ${errors.email ? styles.inputHasError : ''}`}
                    {...register('email')}
                  />
                </div>
                {errors.email && <span className={styles.fieldError}>{errors.email.message}</span>}
              </div>

              {/* Password */}
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="login-password">
                    Password
                  </label>
                </div>
                <div className={styles.inputWrapper}>
                  <Lock size={18} className={styles.inputIcon} aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={`${styles.input} ${errors.password ? styles.inputHasError : ''}`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className={styles.togglePasswordBtn}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <span className={styles.fieldError}>{errors.password.message}</span>}
              </div>

              {/* Options: Remember Me & Forgot Password */}
              <div className={styles.optionsRow}>
                <label className={styles.rememberCheckbox}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me for 30 days</span>
                </label>

                <button
                  type="button"
                  className={styles.forgotBtn}
                  onClick={() => {
                    setForgotSent(false);
                    setForgotOpen(true);
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={styles.submitBtn}
                aria-label="Sign in"
              >
                {isSubmitting ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to Account</span>
                    <ArrowRight size={17} className={styles.btnArrow} />
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <p className={styles.footer}>
              Don't have an account?
              <Link href="/register" className={styles.signupLink}>
                Create an account
              </Link>
            </p>

            {/* Trust badge */}
            <div className={styles.trustBadge}>
              <ShieldCheck size={14} />
              <span>256-bit SSL encrypted • Meow SafeGuard</span>
            </div>
          </div>
        </section>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className={styles.modalBackdrop} onClick={() => setForgotOpen(false)}>
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-modal-title"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 id="forgot-modal-title" className={styles.modalTitle}>Reset your password</h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className={styles.togglePasswordBtn}
                aria-label="Close dialog"
                style={{ position: 'static' }}
              >
                <X size={20} />
              </button>
            </div>

            {forgotSent ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--success-color)', marginBottom: 14 }}>
                  <CheckCircle2 size={24} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Reset link dispatched!</span>
                </div>
                <p className={styles.modalText}>
                  If an account exists for <strong>{forgotEmail}</strong>, we have sent instructions to reset your password. Please check your inbox and spam folder.
                </p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className={styles.modalActionBtn}
                  >
                    Back to Login
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <p className={styles.modalText}>
                  Enter the email address registered with your Meow account. We'll send you a secure verification link to recover access.
                </p>
                <div className={styles.field} style={{ marginBottom: 20 }}>
                  <label className={styles.label} htmlFor="forgot-email-input">
                    Email address
                  </label>
                  <div className={styles.inputWrapper}>
                    <Mail size={18} className={styles.inputIcon} aria-hidden="true" />
                    <input
                      id="forgot-email-input"
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@example.com"
                      className={styles.input}
                      autoFocus
                    />
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className={styles.modalCloseBtn}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.modalActionBtn}
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.loginPage}>
          <div className={styles.spinner} style={{ width: 32, height: 32 }} />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
