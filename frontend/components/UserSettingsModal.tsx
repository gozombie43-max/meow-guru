'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Target,
  ShieldCheck,
  Settings,
  Bell,
  BellOff,
  Swords,
  Trophy,
  Flame,
  FileText,
  CalendarDays,
  Megaphone,
  Clock,
  Globe,
} from 'lucide-react';
import { useThemeMode } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import {
  NotificationPreferences,
  getNotificationPreferences,
  updateNotificationPreferences,
  DailyPracticeReminder,
  getDailyPracticeReminder,
  updateDailyPracticeReminder,
  getStudyGoal,
  updateStudyGoal,
} from '@/lib/userApi';
import styles from './UserProfileMenu.module.css';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOUND_EFFECTS_KEY = 'study-guru-sound-effects';
const DAILY_GOAL_KEY = 'study-guru-daily-goal';

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  battleInvites: true,
  battleResults: true,
  dailyPractice: true,
  newMocks: true,
  examUpdates: true,
  announcements: true,
};

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
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferences | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const detectedTimezone =
    typeof Intl !== 'undefined' && Intl.DateTimeFormat
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
      : 'Asia/Kolkata';

  const [dailyReminder, setDailyReminder] = useState<{
    enabled: boolean;
    time: string;
    timezone: string;
    nextSendAt?: string | null;
    lastSentAt?: string | null;
    streakProtectionEnabled?: boolean;
    streakProtectionTime?: string;
    nextStreakProtectionAt?: string | null;
    lastStreakProtectionSentAt?: string | null;
  }>({
    enabled: false,
    time: '20:00',
    timezone: detectedTimezone,
    streakProtectionEnabled: false,
    streakProtectionTime: '21:30',
  });
  const [reminderLoading, setReminderLoading] = useState(false);

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

  // Load notification preferences and daily reminder from server when modal is opened
  useEffect(() => {
    if (!isOpen || !user) {
      return;
    }

    void getNotificationPreferences()
      .then(setNotificationPreferences)
      .catch(console.error);

    void getDailyPracticeReminder()
      .then((reminder) => {
        if (reminder) {
          setDailyReminder({
            enabled: reminder.enabled === true,
            time: reminder.time || '20:00',
            timezone: reminder.timezone || detectedTimezone,
            nextSendAt: reminder.nextSendAt,
            lastSentAt: reminder.lastSentAt,
            streakProtectionEnabled: reminder.streakProtectionEnabled === true,
            streakProtectionTime: reminder.streakProtectionTime || '21:30',
            nextStreakProtectionAt: reminder.nextStreakProtectionAt,
            lastStreakProtectionSentAt: reminder.lastStreakProtectionSentAt,
          });
        }
      })
      .catch(console.error);

    void getStudyGoal()
      .then((data) => {
        if (data?.dailyGoalMinutes) {
          const minsStr = String(data.dailyGoalMinutes);
          setDailyGoal(minsStr);
          try {
            localStorage.setItem(DAILY_GOAL_KEY, minsStr);
          } catch {}
        }
      })
      .catch(console.error);
  }, [isOpen, user]);

  const toggleNotificationPreference = async (
    key: keyof NotificationPreferences
  ) => {
    if (!notificationPreferences || notificationLoading) {
      return;
    }

    const next = !notificationPreferences[key];
    const previous = notificationPreferences;

    setNotificationPreferences({
      ...previous,
      [key]: next,
    });

    setNotificationLoading(true);

    try {
      const updated = await updateNotificationPreferences({
        [key]: next,
      });

      setNotificationPreferences(updated);
    } catch {
      // Roll back optimistic UI
      setNotificationPreferences(previous);
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleToggleDailyReminder = async () => {
    if (reminderLoading) return;
    const nextEnabled = !dailyReminder.enabled;
    const prev = dailyReminder;
    const updatedState = { ...prev, enabled: nextEnabled };
    setDailyReminder(updatedState);
    setReminderLoading(true);

    try {
      const saved = await updateDailyPracticeReminder({
        enabled: nextEnabled,
        time: updatedState.time,
        timezone: updatedState.timezone || detectedTimezone,
        streakProtectionEnabled: updatedState.streakProtectionEnabled,
        streakProtectionTime: updatedState.streakProtectionTime || '21:30',
      });

      setDailyReminder({
        enabled: saved.enabled === true,
        time: saved.time || '20:00',
        timezone: saved.timezone || detectedTimezone,
        nextSendAt: saved.nextSendAt,
        lastSentAt: saved.lastSentAt,
        streakProtectionEnabled: saved.streakProtectionEnabled === true,
        streakProtectionTime: saved.streakProtectionTime || '21:30',
        nextStreakProtectionAt: saved.nextStreakProtectionAt,
        lastStreakProtectionSentAt: saved.lastStreakProtectionSentAt,
      });
    } catch {
      setDailyReminder(prev);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleReminderTimeChange = async (newTime: string) => {
    const prev = dailyReminder;
    const updatedState = { ...prev, time: newTime };
    setDailyReminder(updatedState);
    if (!updatedState.enabled) return;

    setReminderLoading(true);
    try {
      const saved = await updateDailyPracticeReminder({
        enabled: true,
        time: newTime,
        timezone: updatedState.timezone || detectedTimezone,
        streakProtectionEnabled: updatedState.streakProtectionEnabled,
        streakProtectionTime: updatedState.streakProtectionTime || '21:30',
      });

      setDailyReminder({
        enabled: saved.enabled === true,
        time: saved.time || '20:00',
        timezone: saved.timezone || detectedTimezone,
        nextSendAt: saved.nextSendAt,
        lastSentAt: saved.lastSentAt,
        streakProtectionEnabled: saved.streakProtectionEnabled === true,
        streakProtectionTime: saved.streakProtectionTime || '21:30',
        nextStreakProtectionAt: saved.nextStreakProtectionAt,
        lastStreakProtectionSentAt: saved.lastStreakProtectionSentAt,
      });
    } catch {
      setDailyReminder(prev);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleToggleStreakProtection = async () => {
    if (reminderLoading) return;
    const nextStreakEnabled = !dailyReminder.streakProtectionEnabled;
    const prev = dailyReminder;
    const updatedState = { ...prev, streakProtectionEnabled: nextStreakEnabled };
    setDailyReminder(updatedState);
    setReminderLoading(true);

    try {
      const saved = await updateDailyPracticeReminder({
        enabled: updatedState.enabled,
        time: updatedState.time,
        timezone: updatedState.timezone || detectedTimezone,
        streakProtectionEnabled: nextStreakEnabled,
        streakProtectionTime: updatedState.streakProtectionTime || '21:30',
      });

      setDailyReminder({
        enabled: saved.enabled === true,
        time: saved.time || '20:00',
        timezone: saved.timezone || detectedTimezone,
        nextSendAt: saved.nextSendAt,
        lastSentAt: saved.lastSentAt,
        streakProtectionEnabled: saved.streakProtectionEnabled === true,
        streakProtectionTime: saved.streakProtectionTime || '21:30',
        nextStreakProtectionAt: saved.nextStreakProtectionAt,
        lastStreakProtectionSentAt: saved.lastStreakProtectionSentAt,
      });
    } catch {
      setDailyReminder(prev);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleStreakProtectionTimeChange = async (newTime: string) => {
    const prev = dailyReminder;
    const updatedState = { ...prev, streakProtectionTime: newTime };
    setDailyReminder(updatedState);
    if (!updatedState.streakProtectionEnabled) return;

    setReminderLoading(true);
    try {
      const saved = await updateDailyPracticeReminder({
        enabled: updatedState.enabled,
        time: updatedState.time,
        timezone: updatedState.timezone || detectedTimezone,
        streakProtectionEnabled: true,
        streakProtectionTime: newTime,
      });

      setDailyReminder({
        enabled: saved.enabled === true,
        time: saved.time || '20:00',
        timezone: saved.timezone || detectedTimezone,
        nextSendAt: saved.nextSendAt,
        lastSentAt: saved.lastSentAt,
        streakProtectionEnabled: saved.streakProtectionEnabled === true,
        streakProtectionTime: saved.streakProtectionTime || '21:30',
        nextStreakProtectionAt: saved.nextStreakProtectionAt,
        lastStreakProtectionSentAt: saved.lastStreakProtectionSentAt,
      });
    } catch {
      setDailyReminder(prev);
    } finally {
      setReminderLoading(false);
    }
  };

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
    if (user) {
      void updateStudyGoal(Number(val)).catch(console.error);
    }
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

            {/* Notification Preferences Section */}
            {user && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#0071e3', marginTop: '6px' }}>
                  <Bell size={16} />
                  <span>Notifications</span>
                </div>

                {(() => {
                  const currentPrefs = notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES;
                  const isMasterEnabled = currentPrefs.enabled;

                  const categories: Array<{
                    key: keyof Omit<NotificationPreferences, 'enabled'>;
                    label: string;
                    sublabel: string;
                    icon: React.ReactNode;
                    iconClass: string;
                  }> = [
                    {
                      key: 'battleInvites',
                      label: 'Battle Invites',
                      sublabel: 'Challenges and rematches',
                      icon: <Swords size={18} />,
                      iconClass: styles.iconRed,
                    },
                    {
                      key: 'battleResults',
                      label: 'Battle Results',
                      sublabel: 'Results when a battle finishes',
                      icon: <Trophy size={18} />,
                      iconClass: styles.iconAmber,
                    },
                    {
                      key: 'dailyPractice',
                      label: 'Daily Practice',
                      sublabel: 'Daily study reminders',
                      icon: <Flame size={18} />,
                      iconClass: styles.iconOrange,
                    },
                    {
                      key: 'newMocks',
                      label: 'New Mock Tests',
                      sublabel: 'New SSC/Railway mocks',
                      icon: <FileText size={18} />,
                      iconClass: styles.iconBlue,
                    },
                    {
                      key: 'examUpdates',
                      label: 'Exam Updates',
                      sublabel: 'Dates, admit cards and results',
                      icon: <CalendarDays size={18} />,
                      iconClass: styles.iconTeal,
                    },
                    {
                      key: 'announcements',
                      label: 'Announcements',
                      sublabel: 'Important Meow updates',
                      icon: <Megaphone size={18} />,
                      iconClass: styles.iconPurple,
                    },
                  ];

                  return (
                    <>
                      {/* Master Push Notification Switch */}
                      <div className={styles.settingItem}>
                        <div className={styles.settingInfo}>
                          <div className={`${styles.settingIconBox} ${isMasterEnabled ? styles.iconBlue : styles.iconPurple}`}>
                            {isMasterEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                          </div>
                          <div className={styles.settingLabelGroup}>
                            <span className={styles.settingLabel}>Push Notifications</span>
                            <span className={styles.settingSublabel}>
                              {isMasterEnabled ? 'Notifications enabled' : 'All notifications paused'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isMasterEnabled}
                          onClick={() => toggleNotificationPreference('enabled')}
                          className={`${styles.switchToggle} ${isMasterEnabled ? styles.switchActive : ''}`}
                          aria-label="Toggle push notifications"
                          disabled={notificationLoading}
                        >
                          <span className={styles.switchThumb} />
                        </button>
                      </div>

                      {/* Category Switches */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          opacity: isMasterEnabled ? 1 : 0.45,
                          pointerEvents: isMasterEnabled ? 'auto' : 'none',
                          transition: 'opacity 0.2s ease',
                        }}
                      >
                        {categories.map((cat) => {
                          const isCatActive = currentPrefs[cat.key];
                          return (
                            <div key={cat.key} className={styles.settingItem} style={{ padding: '10px 14px' }}>
                              <div className={styles.settingInfo}>
                                <div className={`${styles.settingIconBox} ${cat.iconClass}`}>
                                  {cat.icon}
                                </div>
                                <div className={styles.settingLabelGroup}>
                                  <span className={styles.settingLabel}>{cat.label}</span>
                                  <span className={styles.settingSublabel}>{cat.sublabel}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isCatActive}
                                onClick={() => toggleNotificationPreference(cat.key)}
                                className={`${styles.switchToggle} ${isCatActive ? styles.switchActive : ''}`}
                                aria-label={`Toggle ${cat.label}`}
                                disabled={!isMasterEnabled || notificationLoading}
                              >
                                <span className={styles.switchThumb} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Daily Practice Reminder Configuration */}
                      <div
                        className={styles.settingItem}
                        style={{
                          flexDirection: 'column',
                          alignItems: 'stretch',
                          gap: '12px',
                          opacity: isMasterEnabled ? 1 : 0.45,
                          pointerEvents: isMasterEnabled ? 'auto' : 'none',
                          transition: 'opacity 0.2s ease',
                          marginTop: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div className={styles.settingInfo}>
                            <div className={`${styles.settingIconBox} ${styles.iconOrange}`}>
                              <Flame size={18} />
                            </div>
                            <div className={styles.settingLabelGroup}>
                              <span className={styles.settingLabel}>Daily Practice Reminder</span>
                              <span className={styles.settingSublabel}>
                                {dailyReminder.enabled
                                  ? "You'll receive one practice reminder each day"
                                  : 'Schedule a daily reminder at your preferred time'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={dailyReminder.enabled}
                            onClick={handleToggleDailyReminder}
                            className={`${styles.switchToggle} ${dailyReminder.enabled ? styles.switchActive : ''}`}
                            aria-label="Toggle daily practice reminder"
                            disabled={!isMasterEnabled || reminderLoading}
                          >
                            <span className={styles.switchThumb} />
                          </button>
                        </div>

                        {dailyReminder.enabled && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px',
                              padding: '12px 14px',
                              borderRadius: '12px',
                              background: 'rgba(0, 0, 0, 0.03)',
                              border: '1px solid rgba(0, 0, 0, 0.06)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                                <Clock size={15} style={{ color: '#ea580c' }} />
                                <span>Reminder time</span>
                              </div>
                              <input
                                type="time"
                                value={dailyReminder.time}
                                onChange={(e) => void handleReminderTimeChange(e.target.value)}
                                disabled={!isMasterEnabled || reminderLoading}
                                aria-label="Daily reminder time"
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(0, 0, 0, 0.15)',
                                  background: 'transparent',
                                  color: 'inherit',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  outline: 'none',
                                }}
                              />
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6e6e73' }}>
                                <Globe size={14} />
                                <span>Timezone</span>
                              </div>
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#6e6e73',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {dailyReminder.timezone || detectedTimezone}
                              </span>
                            </div>

                            {dailyReminder.nextSendAt && (
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: '#16a34a',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <span>Next reminder:</span>
                                <span style={{ fontWeight: 600 }}>
                                  {new Date(dailyReminder.nextSendAt).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                            )}

                            {/* Streak Protection Sub-section */}
                            <div
                              style={{
                                marginTop: '4px',
                                paddingTop: '10px',
                                borderTop: '1px solid rgba(0, 0, 0, 0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                                    <Flame size={15} style={{ color: '#ea580c' }} />
                                    <span>Streak Protection</span>
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#6e6e73', marginTop: '2px' }}>
                                    Extra reminder if a 2+ day streak is at risk
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={dailyReminder.streakProtectionEnabled === true}
                                  aria-label="Toggle streak protection"
                                  disabled={!isMasterEnabled || reminderLoading}
                                  onClick={() => void handleToggleStreakProtection()}
                                  className={`${styles.switchToggle} ${dailyReminder.streakProtectionEnabled ? styles.switchActive : ''}`}
                                >
                                  <span className={styles.switchThumb} />
                                </button>
                              </div>

                              {dailyReminder.streakProtectionEnabled && (
                                <>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      flexWrap: 'wrap',
                                      gap: '8px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6e6e73' }}>
                                      <Clock size={13} />
                                      <span>Protection time</span>
                                    </div>
                                    <input
                                      type="time"
                                      value={dailyReminder.streakProtectionTime || '21:30'}
                                      onChange={(e) => void handleStreakProtectionTimeChange(e.target.value)}
                                      disabled={!isMasterEnabled || reminderLoading}
                                      aria-label="Streak protection time"
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(0, 0, 0, 0.15)',
                                        background: 'transparent',
                                        color: 'inherit',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        outline: 'none',
                                      }}
                                    />
                                  </div>

                                  <div
                                    style={{
                                      fontSize: '11px',
                                      color: '#6e6e73',
                                      background: 'rgba(0, 0, 0, 0.02)',
                                      padding: '8px 10px',
                                      borderRadius: '8px',
                                      lineHeight: '1.4',
                                    }}
                                  >
                                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>Only alerts you when:</div>
                                    <div>• You have a 2+ day streak</div>
                                    <div>• Today&apos;s goal isn&apos;t complete</div>
                                    <div>• You haven&apos;t studied for 90 minutes</div>
                                  </div>

                                  {dailyReminder.nextStreakProtectionAt && (
                                    <div
                                      style={{
                                        fontSize: '11px',
                                        color: '#ea580c',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                      }}
                                    >
                                      <span>Next protection check:</span>
                                      <span style={{ fontWeight: 600 }}>
                                        {new Date(dailyReminder.nextStreakProtectionAt).toLocaleString([], {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: true,
                                        })}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </>
            )}

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
