'use client';

import { useState, useMemo, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/axios';
import { API_BASE } from '@/lib/api-base';
import styles from './register.module.css';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Target,
  TrendingUp,
  Award,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';
import WolfIcon from '@/components/WolfIcon';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

function RegisterContent() {
  const { login } = useAuth();
  const router = useRouter();

  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const passwordValue = watch('password') || '';

  // Calculate live password strength
  const passwordStrength = useMemo(() => {
    if (!passwordValue) return { score: 0, label: '', class: '' };
    let score = 0;
    if (passwordValue.length >= 6) score += 1;
    if (passwordValue.length >= 9 && /[0-9]/.test(passwordValue)) score += 1;
    if (/[A-Z]/.test(passwordValue) && /[^A-Za-z0-9]/.test(passwordValue)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', class: styles.strengthWeak };
    if (score === 2) return { score: 2, label: 'Fair', class: styles.strengthMedium };
    return { score: 3, label: 'Strong', class: styles.strengthStrong };
  }, [passwordValue]);

  const handleGoogleSignup = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  const onSubmit = async (data: RegisterFormData) => {
    setError('');
    try {
      const res = await api.post('/auth/register', data);
      await login(res.data.token);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Registration failed. Please check your details and try again.');
    }
  };

  return (
    <main className={styles.registerPage}>
      {/* Dynamic Ambient Background Lights */}
      <div className={styles.ambientBlob1} aria-hidden="true" />
      <div className={styles.ambientBlob2} aria-hidden="true" />
      <div className={styles.ambientBlob3} aria-hidden="true" />
      <div className={styles.ambientGrid} aria-hidden="true" />

      {/* Main Glass Shell */}
      <div className={styles.shell}>
        {/* Left Showcase Pane (Desktop) */}
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
                <span>Free 7-Day Pro Access</span>
              </div>
              <h1 className={styles.heroTitle}>
                Start Your Journey to<br />
                <span className={styles.heroTitleAccent}>All India Rank.</span>
              </h1>
              <p className={styles.heroSubtitle}>
                Join 45,000+ serious SSC aspirants practicing with AI-calibrated mock drills, formula flashcards, and instant explanations.
              </p>
            </div>

            {/* Feature Cards Stack */}
            <div className={styles.featuresStack}>
              <div className={styles.featureCard}>
                <div className={`${styles.featureIconWrap} ${styles.iconPurple}`}>
                  <Target size={20} />
                </div>
                <div className={styles.featureMeta}>
                  <span className={styles.featureTitle}>Targeted Exam Modules</span>
                  <span className={styles.featureDesc}>Full syllabus coverage for CGL, CHSL, MTS &amp; GD.</span>
                </div>
              </div>

              <div className={styles.featureCard}>
                <div className={`${styles.featureIconWrap} ${styles.iconCyan}`}>
                  <TrendingUp size={20} />
                </div>
                <div className={styles.featureMeta}>
                  <span className={styles.featureTitle}>Real-time Accuracy Tracker</span>
                  <span className={styles.featureDesc}>Deep diagnostics to eliminate silly mistakes in Math &amp; Reasoning.</span>
                </div>
              </div>

              <div className={styles.featureCard}>
                <div className={`${styles.featureIconWrap} ${styles.iconEmerald}`}>
                  <Award size={20} />
                </div>
                <div className={styles.featureMeta}>
                  <span className={styles.featureTitle}>National Leaderboards</span>
                  <span className={styles.featureDesc}>Compete daily with toppers across India and track percentiles.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Social Proof Footer */}
          <div className={styles.showcaseBottom}>
            <div className={styles.avatarGroup}>
              <div className={styles.avatarItem}>R1</div>
              <div className={styles.avatarItem}>S8</div>
              <div className={styles.avatarItem}>M5</div>
              <span className={styles.socialStat}>45,000+ aspirants enrolled</span>
            </div>

            <div className={styles.liveBadge}>
              <span className={styles.liveDot} />
              <span>Free Account</span>
            </div>
          </div>
        </aside>

        {/* Right Registration Pane */}
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
              <h2 className={styles.formTitle}>Create your account 🚀</h2>
              <p className={styles.formSubtitle}>Start your preparation streak today.</p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className={styles.alertError} role="alert">
                <AlertCircle size={18} className={styles.alertIcon} />
                <div>{error}</div>
              </div>
            )}

            {/* Google Sign-up */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              className={styles.googleBtn}
              aria-label="Sign up with Google"
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
              <span>Sign up with Google</span>
            </button>

            {/* Divider */}
            <div className={styles.divider}>
              <div className={styles.dividerLine} />
              <span className={styles.dividerText}>or register with email</span>
              <div className={styles.dividerLine} />
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
              {/* Full Name */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="register-name">
                  Full name
                </label>
                <div className={styles.inputWrapper}>
                  <User size={18} className={styles.inputIcon} aria-hidden="true" />
                  <input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Enter your full name"
                    className={`${styles.input} ${errors.name ? styles.inputHasError : ''}`}
                    {...register('name')}
                  />
                </div>
                {errors.name && <span className={styles.fieldError}>{errors.name.message}</span>}
              </div>

              {/* Email */}
              <div className={styles.field}>
                <label className={styles.label} htmlFor="register-email">
                  Email address
                </label>
                <div className={styles.inputWrapper}>
                  <Mail size={18} className={styles.inputIcon} aria-hidden="true" />
                  <input
                    id="register-email"
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
                  <label className={styles.label} htmlFor="register-password">
                    Password
                  </label>
                </div>
                <div className={styles.inputWrapper}>
                  <Lock size={18} className={styles.inputIcon} aria-hidden="true" />
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
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

                {/* Password Strength Meter */}
                {passwordValue.length > 0 && (
                  <div className={styles.strengthContainer}>
                    <div className={styles.strengthBarWrap}>
                      <div
                        className={`${styles.strengthSegment} ${
                          passwordStrength.score >= 1
                            ? passwordStrength.score === 1
                              ? styles.strengthSegmentActiveWeak
                              : passwordStrength.score === 2
                              ? styles.strengthSegmentActiveMedium
                              : styles.strengthSegmentActiveStrong
                            : ''
                        }`}
                      />
                      <div
                        className={`${styles.strengthSegment} ${
                          passwordStrength.score >= 2
                            ? passwordStrength.score === 2
                              ? styles.strengthSegmentActiveMedium
                              : styles.strengthSegmentActiveStrong
                            : ''
                        }`}
                      />
                      <div
                        className={`${styles.strengthSegment} ${
                          passwordStrength.score >= 3
                            ? styles.strengthSegmentActiveStrong
                            : ''
                        }`}
                      />
                    </div>
                    <div className={styles.strengthLabelRow}>
                      <span className={styles.strengthLabelText}>Password strength:</span>
                      <span className={`${styles.strengthStatus} ${passwordStrength.class}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Terms Checkbox */}
              <label className={styles.termsRow}>
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span>
                  I agree to Meow's Terms of Service and Privacy Policy.
                </span>
              </label>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting || !agreedToTerms}
                className={styles.submitBtn}
                aria-label="Create account"
              >
                {isSubmitting ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Free Account</span>
                    <ArrowRight size={17} className={styles.btnArrow} />
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <p className={styles.footer}>
              Already have an account?
              <Link href="/login" className={styles.loginLink}>
                Sign in
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
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.registerPage}>
          <div className={styles.spinner} style={{ width: 32, height: 32 }} />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
