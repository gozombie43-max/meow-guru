'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/axios';
import { API_BASE } from '@/lib/api-base';
import {
  AuthCard,
  AuthInput,
  AuthGoogleButton,
  PasswordStrengthBar,
} from '@/components/auth';
import styles from '@/components/auth/auth.module.css';

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
    <AuthCard
      title="Create Account"
      subtitle="Start your preparation streak"
      activeTab="register"
      error={error}
      footerText="Already have an account?"
      footerLinkText="Sign in"
      footerLinkHref="/login"
    >
      {/* Google Sign-up */}
      <AuthGoogleButton
        onClick={handleGoogleSignup}
        text="Sign up with Google"
      />

      {/* Subtle Divider */}
      <div className={styles.divider}>
        <div className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <div className={styles.dividerLine} />
      </div>

      {/* Registration Form */}
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form} noValidate>
        <AuthInput
          id="register-name"
          label="Full Name"
          type="text"
          autoComplete="name"
          placeholder="Your full name"
          icon={<User size={17} />}
          error={errors.name?.message}
          {...register('name')}
        />

        <AuthInput
          id="register-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          icon={<Mail size={17} />}
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <AuthInput
            id="register-password"
            label="Password"
            type="password"
            isPassword
            autoComplete="new-password"
            placeholder="At least 6 characters"
            icon={<Lock size={17} />}
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrengthBar password={passwordValue} />
        </div>

        {/* Terms Agreement Checkbox */}
        <label className={styles.termsRow}>
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
          />
          <span>
            I agree to the Terms of Service and Privacy Policy.
          </span>
        </label>

        {/* Primary iOS Action Button */}
        <button
          type="submit"
          disabled={isSubmitting || !agreedToTerms}
          className={styles.primaryBtn}
          aria-label="Create account"
        >
          {isSubmitting ? (
            <span className={styles.spinner} aria-hidden="true" />
          ) : (
            <>
              <span>Create Account</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.authContainer}>
          <div className={styles.spinner} style={{ borderColor: 'rgba(0, 122, 255, 0.3)', borderTopColor: '#007aff' }} />
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
