
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api, { setStoredRefreshToken } from '@/lib/axios';
import { useState } from 'react';
import styles from '../login/login.module.css';

const schema = z.object({
  name:     z.string().min(2, 'Name too short'),
  email:    z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 characters'),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Google login handler
  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      const res = await api.post('/auth/register', data);
      if (res.data.refreshToken) setStoredRefreshToken(res.data.refreshToken);
      await login(res.data.token);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Registration failed');
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <aside className={styles.illustration}>
          <Link href="/" className={styles.brand} aria-label="Go to homepage">
            <span className={styles.brandIcon} aria-hidden="true" />
            <span className={styles.brandText}>GeoLog</span>
          </Link>

          <div className={styles.characters} aria-hidden="true">
            <div className={`${styles.character} ${styles.characterPurple} ${styles.floatSlow}`}>
              <div className={styles.face}>
                <span className={styles.eye} />
                <span className={styles.eye} />
                <span className={styles.smile} />
              </div>
            </div>
            <div className={`${styles.character} ${styles.characterDark} ${styles.floatMid}`}>
              <div className={styles.face}>
                <span className={styles.eye} />
                <span className={styles.eye} />
                <span className={styles.smile} />
              </div>
            </div>
            <div className={`${styles.character} ${styles.characterOrange} ${styles.floatFast}`}>
              <div className={styles.face}>
                <span className={styles.eye} />
                <span className={styles.eye} />
                <span className={styles.smile} />
              </div>
            </div>
            <div className={`${styles.character} ${styles.characterYellow} ${styles.floatSlow}`}>
              <div className={styles.face}>
                <span className={styles.eye} />
                <span className={styles.eye} />
                <span className={styles.smile} />
              </div>
            </div>
          </div>

          <span className={`${styles.sparkle} ${styles.sparkleOne}`} aria-hidden="true" />
          <span className={`${styles.sparkle} ${styles.sparkleTwo}`} aria-hidden="true" />
          <span className={`${styles.sparkle} ${styles.sparkleThree}`} aria-hidden="true" />
        </aside>

        <section className={styles.formPane}>
          <div className={styles.formCard}>
            <div>
              <h1 className={styles.heading}>Create your account</h1>
              <p className={styles.subheading}>Start your next practice streak in minutes.</p>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="register-name">Full name</label>
                <input
                  id="register-name"
                  type="text"
                  placeholder="Enter your name"
                  className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                  {...register('name')}
                />
                {errors.name && <p className={styles.fieldError}>{errors.name.message}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="register-email">Email address</label>
                <input
                  id="register-email"
                  type="email"
                  placeholder="Enter your email"
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                  {...register('email')}
                />
                {errors.email && <p className={styles.fieldError}>{errors.email.message}</p>}
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="register-password">Password</label>
                <div className={styles.inputWrap}>
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className={styles.eyeButton}
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <path d="M14.5 9.5a3.5 3.5 0 1 1-5 5" />
                        <path d="M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && <p className={styles.fieldError}>{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={isSubmitting} className={styles.primaryButton}>
                {isSubmitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <div className={styles.divider}>
              <div className={styles.dividerLine} />
              <span>or</span>
              <div className={styles.dividerLine} />
            </div>

            <button type="button" onClick={handleGoogleLogin} className={styles.secondaryButton}>
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign up with Google
            </button>

            <p className={styles.footer}>
              Already have an account? <Link href="/login">Log in</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}