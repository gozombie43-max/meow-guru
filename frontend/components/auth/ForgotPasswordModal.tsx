'use client';

import { Dialog } from "@/components/ui/Dialog";
import React, { useEffect, useRef, useState } from 'react';
import { Mail, X, CheckCircle2 } from 'lucide-react';
import styles from './auth.module.css';
import api from '@/shared/api/client';
import { emailPattern } from './validation';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  return isOpen ? <ForgotPasswordContent onClose={onClose} /> : null;
}

function ForgotPasswordContent({ onClose }: Pick<ForgotPasswordModalProps, 'onClose'>) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail.length > 254 || !emailPattern.test(normalizedEmail) || sending || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setSending(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: normalizedEmail }, { signal: controller.signal });
      if (!controller.signal.aborted) setSent(true);
    } catch {
      if (!controller.signal.aborted) setError('Unable to send reset instructions right now. Please try again.');
    } finally {
      if (!controller.signal.aborted) {
        requestRef.current = null;
        setSending(false);
      }
    }
  };

  const handleClose = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setSent(false);
    setSending(false);
    setError('');
    setEmail('');
    onClose();
  };

  return (
    <Dialog onClose={handleClose} className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="password-recovery-title">
      <div className={styles.modalSheet}>
        <div data-ui-chrome="header" className={styles.modalHeader}>
          <h3 id="password-recovery-title" className={styles.modalTitle}>Password Recovery</h3>
          <button data-ui-button="icon"
            type="button"
            onClick={handleClose}
            className={styles.modalCloseBtn}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34c759', margin: '14px 0 10px' }}>
              <CheckCircle2 size={20} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Check your inbox</span>
            </div>
            <p className={styles.modalDescription}>
              If an account is associated with <strong>{email.trim().toLowerCase()}</strong>, we've sent instructions to reset your password.
            </p>
            <div className={styles.modalActions}>
              <button data-ui-button="primary"
                type="button"
                onClick={handleClose}
                className={styles.modalSubmitBtn}
                style={{ width: '100%' }}
              >
                Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className={styles.modalDescription}>
              Enter your registered email address to receive password recovery instructions.
            </p>
            <div className={styles.fieldGroup} style={{ marginBottom: 12 }}>
              <label htmlFor="recovery-email" className={styles.fieldLabel}>
                Email address
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputLeadingIcon}>
                  <Mail size={17} />
                </span>
                <input
                  id="recovery-email"
                  aria-label="Email address"
                  type="email"
                  required
                  disabled={sending}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.inputField}
                />
              </div>
            </div>
            {error && <p role="alert" className={styles.modalDescription}>{error}</p>}
            <div className={styles.modalActions}>
              <button data-ui-button="secondary"
                type="button"
                onClick={handleClose}
                className={styles.modalCancelBtn}
              >
                Cancel
              </button>
              <button data-ui-button="primary"
                type="submit"
                className={styles.modalSubmitBtn}
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Send Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
