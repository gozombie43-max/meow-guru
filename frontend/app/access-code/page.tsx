'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const CODE_LENGTH = 4;

export default function AccessCodePage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Must wait for mount before using portal (SSR safety)
  useEffect(() => { setMounted(true); }, []);

  // Override html/body background for this page (globals.css sets a light gradient)
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const origHtmlBg = html.style.background;
    const origBodyBg = body.style.background;

    html.style.background = '#0a0a0f';
    body.style.background = '#0a0a0f';

    return () => {
      html.style.background = origHtmlBg;
      body.style.background = origBodyBg;
    };
  }, []);

  // Focus first input on mount
  useEffect(() => {
    if (mounted) {
      const blockUntil = localStorage.getItem('accessCodeBlockUntil');
      if (blockUntil) {
        const blockTime = parseInt(blockUntil, 10);
        if (blockTime > Date.now()) {
          setAttempts(3);
          setError('Maximum attempts reached. Try again in 24 hours.');
          return;
        } else {
          localStorage.removeItem('accessCodeBlockUntil');
        }
      }
      inputRefs.current[0]?.focus();
    }
  }, [mounted]);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  const verifyCode = useCallback(async (code: string) => {
    if (attempts >= 3) return;
    setLoading(true);
    setError('');

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';
      const res = await fetch(`${apiBase}/api/access-code/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (data.valid) {
        // Set the cookie on the frontend domain so proxy.ts can read it (expires in 24 hours)
        document.cookie = 'access_session=1; path=/; max-age=86400';
        setSuccess(true);
        setLoading(false);
        // Brief success animation, then redirect
        setTimeout(() => {
          window.location.href = '/';
        }, 600);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 3) {
          localStorage.setItem('accessCodeBlockUntil', (Date.now() + 24 * 60 * 60 * 1000).toString());
          setError('Maximum attempts reached. Try again in 24 hours.');
        } else {
          setError(data.error || 'Invalid access code');
        }
        triggerShake();
        setLoading(false);
        // Clear inputs after error
        setTimeout(() => {
          setDigits(Array(CODE_LENGTH).fill(''));
          inputRefs.current[0]?.focus();
        }, 800);
      }
    } catch {
      setError('Connection error. Please try again.');
      triggerShake();
      setLoading(false);
    }
  }, [router, triggerShake, attempts]);

  const handleChange = useCallback(
    (index: number, value: string) => {
      // Only allow digits
      const digit = value.replace(/\D/g, '').slice(-1);

      setDigits((prev) => {
        const next = [...prev];
        next[index] = digit;

        // Auto-advance to next input
        if (digit && index < CODE_LENGTH - 1) {
          setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
        }

        // Auto-submit when all digits filled
        if (digit && index === CODE_LENGTH - 1) {
          const fullCode = next.join('');
          if (fullCode.length === CODE_LENGTH) {
            setTimeout(() => verifyCode(fullCode), 100);
          }
        }

        return next;
      });

      if (attempts < 3) {
        setError('');
      }
    },
    [verifyCode, attempts]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (!digits[index] && index > 0) {
          // Move to previous input on backspace of empty field
          setDigits((prev) => {
            const next = [...prev];
            next[index - 1] = '';
            return next;
          });
          inputRefs.current[index - 1]?.focus();
          e.preventDefault();
        }
      } else if (e.key === 'Enter') {
        const code = digits.join('');
        if (code.length === CODE_LENGTH && !loading) {
          verifyCode(code);
        }
      }
    },
    [digits, loading, verifyCode]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      if (attempts >= 3) return;
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
      if (!pasted) return;

      const newDigits = Array(CODE_LENGTH).fill('');
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);
      setError('');

      // Focus last filled or next empty
      const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIndex]?.focus();

      // Auto-submit if full code pasted
      if (pasted.length === CODE_LENGTH) {
        setTimeout(() => verifyCode(pasted), 100);
      }
    },
    [verifyCode]
  );

  const handleSubmit = useCallback(() => {
    const code = digits.join('');
    if (code.length === CODE_LENGTH && !loading) {
      verifyCode(code);
    }
  }, [digits, loading, verifyCode]);

  const allFilled = digits.every((d) => d !== '');

  const content = (
    <div className={styles.pageWrapper}>
      <div className={styles.card}>
        {/* Lock icon */}
        <div className={styles.lockIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M18 10H17V8C17 5.24 14.76 3 12 3C9.24 3 7 5.24 7 8V10H6C4.9 10 4 10.9 4 12V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V12C20 10.9 19.1 10 18 10ZM12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17ZM15 10H9V8C9 6.34 10.34 5 12 5C13.66 5 15 6.34 15 8V10Z"
              fill="#6366f1"
            />
          </svg>
        </div>

        {/* Brand */}
        <div className={styles.brandLockup}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <rect x="0" y="0" width="15" height="15" rx="5" fill="#7b5cf0" />
            <rect x="19" y="0" width="15" height="15" rx="5" fill="#8a6bf5" />
            <rect x="0" y="19" width="15" height="15" rx="5" fill="#6a4de0" />
            <rect x="19" y="19" width="15" height="15" rx="5" fill="#8a6bf5" />
          </svg>
          <div className={styles.brandWord}>
            <span className={styles.brandStudy}>STUDY</span>
            <span className={styles.brandGuru}>GURU</span>
          </div>
        </div>

        {/* Title */}
        <h1 className={styles.title}>Enter Access Code</h1>
        <p className={styles.subtitle}>
          Enter the <span className={styles.subtitleBold}>4-digit code</span> from your invite to continue.
        </p>

        {/* Code inputs */}
        <div className={`${styles.codeRow} ${shaking ? styles.shake : ''}`}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete="one-time-code"
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={i === 0 ? handlePaste : undefined}
              disabled={loading || success || attempts >= 3}
              className={`${styles.codeInput} ${
                error ? styles.codeInputError : ''
              } ${success ? styles.codeInputSuccess : ''}`}
              placeholder="·"
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {/* Error / Success */}
        {success ? (
          <div className={styles.successMsg}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1C4.13 1 1 4.13 1 8C1 11.87 4.13 15 8 15C11.87 15 15 11.87 15 8C15 4.13 11.87 1 8 1ZM6.5 11.5L3 8L4.06 6.94L6.5 9.38L11.94 3.94L13 5L6.5 11.5Z"
                fill="#30d158"
              />
            </svg>
            Access granted!
          </div>
        ) : (
          <div className={`${styles.errorMsg} ${error ? styles.errorVisible : ''}`}>
            {error}
          </div>
        )}

        {/* Continue button */}
        <button
          className={styles.continueBtn}
          disabled={!allFilled || loading || success || attempts >= 3}
          onClick={handleSubmit}
        >
          {loading ? (
            <>
              <span className={styles.spinner} />
              Verifying...
            </>
          ) : success ? (
            'Redirecting...'
          ) : (
            'Continue'
          )}
        </button>

        <p className={styles.infoText}>
          This content is invite-only.<br />
          Contact your instructor for access.
        </p>
      </div>
    </div>
  );

  // Render as portal on document.body to escape PageTransitionShell's transform
  // (CSS transforms create a new containing block that breaks position:fixed)
  if (!mounted) return null;
  return createPortal(content, document.body);
}

