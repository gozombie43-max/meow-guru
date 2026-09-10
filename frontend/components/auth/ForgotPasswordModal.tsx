'use client';

import React, { useState } from 'react';
import { Mail, X, CheckCircle2 } from 'lucide-react';
import styles from './auth.module.css';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    setSent(true);
  };

  const handleClose = () => {
    setSent(false);
    setEmail('');
    onClose();
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="password-recovery-title">
      <div className={styles.modalSheet}>
        <div className={styles.modalHeader}>
          <h3 id="password-recovery-title" className={styles.modalTitle}>Password Recovery</h3>
          <button
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
              If an account is associated with <strong>{email}</strong>, we've sent instructions to reset your password.
            </p>
            <div className={styles.modalActions}>
              <button
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
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.inputField}
                 aria-label="name@example.com"/>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={handleClose}
                className={styles.modalCancelBtn}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.modalSubmitBtn}
              >
                Send Link
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
