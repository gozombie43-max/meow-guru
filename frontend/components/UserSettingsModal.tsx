'use client';

import React, { useState, useEffect } from 'react';
import { X, Sun, Moon, Volume2, VolumeX, Target, ShieldCheck, Settings } from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import styles from './UserProfileMenu.module.css';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOUND_EFFECTS_KEY = 'study-guru-sound-effects';
const DAILY_GOAL_KEY = 'study-guru-daily-goal';

function getRoleTitle(role?: string) {
  const r = (role || 'user').toLowerCase();
  switch (r) {
    case 'superadmin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Moderator';
    case 'student':
      return 'Student Member';
    case 'user':
    default:
      return 'User';
  }
}

export default function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const { theme, toggleThemeMode } = useThemeMode();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dailyGoal, setDailyGoal] = useState('30');

  // Load user local preferences
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedSound = localStorage.getItem(SOUND_EFFECTS_KEY);
      if (storedSound !== null) setSoundEnabled(storedSound === 'true');

      const storedGoal = localStorage.getItem(DAILY_GOAL_KEY);
      if (storedGoal) setDailyGoal(storedGoal);
    } catch {}
  }, [isOpen]);

  // ESC key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem(SOUND_EFFECTS_KEY, String(next));
    } catch {}
  };

  const handleGoalChange = (val: string) => {
    setDailyGoal(val);
    try {
      localStorage.setItem(DAILY_GOAL_KEY, val);
    } catch {}
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <div className={styles.modalTitleIcon}>
              <Settings size={18} />
            </div>
            <h2 id="settings-title" className={styles.modalTitle}>Preferences & Settings</h2>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          <div className={styles.settingsList}>
            {/* Dark Mode Toggle */}
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <div className={`${styles.settingIconBox} ${styles.iconPurple}`}>
                  {isDark ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <div className={styles.settingLabelGroup}>
                  <span className={styles.settingLabel}>Dark Theme</span>
                  <span className={styles.settingSublabel}>
                    {isDark ? 'Dark appearance active' : 'Light appearance active'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isDark}
                onClick={toggleThemeMode}
                className={`${styles.switchToggle} ${isDark ? styles.switchActive : ''}`}
                aria-label="Toggle dark mode"
              >
                <span className={styles.switchThumb} />
              </button>
            </div>

            {/* Sound Effects Toggle */}
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <div className={`${styles.settingIconBox} ${styles.iconBlue}`}>
                  {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </div>
                <div className={styles.settingLabelGroup}>
                  <span className={styles.settingLabel}>Sound Effects</span>
                  <span className={styles.settingSublabel}>
                    {soundEnabled ? 'Play interactive audio feedback' : 'Mute all sounds'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={soundEnabled}
                onClick={handleToggleSound}
                className={`${styles.switchToggle} ${soundEnabled ? styles.switchActive : ''}`}
                aria-label="Toggle sound effects"
              >
                <span className={styles.switchThumb} />
              </button>
            </div>

            {/* Daily Target / Goal */}
            <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className={styles.settingInfo}>
                  <div className={`${styles.settingIconBox} ${styles.iconAmber}`}>
                    <Target size={18} />
                  </div>
                  <div className={styles.settingLabelGroup}>
                    <span className={styles.settingLabel}>Daily Study Goal</span>
                    <span className={styles.settingSublabel}>Target study time per day</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {['15', '30', '45', '60'].map((mins) => {
                  const active = dailyGoal === mins;
                  return (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleGoalChange(mins)}
                      style={{
                        padding: '8px 0',
                        borderRadius: '10px',
                        border: active ? '1.5px solid #0071e3' : '1px solid rgba(0,0,0,0.08)',
                        background: active ? 'rgba(0, 113, 227, 0.12)' : 'transparent',
                        color: active ? '#0071e3' : 'inherit',
                        fontSize: '13px',
                        fontWeight: active ? 700 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {mins}m
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Info Box */}
            {user && (
              <div className={styles.accountCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#0071e3', marginBottom: '2px' }}>
                  <ShieldCheck size={16} />
                  <span>Account Summary</span>
                </div>
                <div className={styles.accountRow}>
                  <span className={styles.accountKey}>Account Email</span>
                  <span className={styles.accountVal}>{user.email}</span>
                </div>
                <div className={styles.accountRow}>
                  <span className={styles.accountKey}>Role</span>
                  <span className={styles.accountVal}>
                    {user.id ? getRoleTitle(user.role) : 'Guest'}
                  </span>
                </div>
                {user.id && (
                  <div className={styles.accountRow}>
                    <span className={styles.accountKey}>User ID</span>
                    <span className={styles.accountVal} style={{ fontSize: '11px', fontFamily: 'monospace', opacity: 0.8 }}>
                      {user.id.slice(0, 12)}...
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
