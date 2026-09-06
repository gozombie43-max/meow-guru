'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './auth.module.css';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  error?: string;
  isPassword?: boolean;
}

export default function AuthInput({
  id,
  label,
  icon,
  error,
  isPassword = false,
  type = 'text',
  className,
  ...props
}: AuthInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={styles.fieldGroup}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <div className={styles.inputWrapper}>
        {icon && <span className={styles.inputLeadingIcon}>{icon}</span>}
        <input
          id={id}
          type={inputType}
          className={`${styles.inputField} ${error ? styles.inputError : ''} ${className || ''}`}
          style={!icon ? { paddingLeft: '14px' } : undefined}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className={styles.passwordToggleBtn}
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <span className={styles.fieldErrorText}>{error}</span>}
    </div>
  );
}
