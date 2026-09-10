'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, User as UserIcon, Image as ImageIcon, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import GoogleAvatarRing from './GoogleAvatarRing';
import { useAuth } from '@/context/AuthContext';
import styles from './UserProfileMenu.module.css';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Curated high-quality avatar presets
const PRESET_AVATARS = [
  { id: 'cat', label: 'Cat Guru 🐱', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CatGuru&backgroundColor=b6e3f4' },
  { id: 'scholar', label: 'Scholar 🎓', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Scholar&backgroundColor=c0aede' },
  { id: 'brainiac', label: 'Brainiac 🦉', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Brainiac&backgroundColor=ffd5dc' },
  { id: 'champion', label: 'Champion 🏆', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Champion&backgroundColor=d1d4f9' },
  { id: 'astronaut', label: 'Astronaut 🚀', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Astro&backgroundColor=ffdfbf' },
  { id: 'fox', label: 'Swift Fox 🦊', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Fox&backgroundColor=b6e3f4' },
  { id: 'coder', label: 'Master Coder 💻', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Coder&backgroundColor=c0aede' },
  { id: 'lion', label: 'King Lion 🦁', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Lion&backgroundColor=ffd5dc' },
  { id: 'ninja', label: 'Study Ninja 🥷', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ninja&backgroundColor=d1d4f9' },
  { id: 'panda', label: 'Zen Panda 🐼', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Panda&backgroundColor=ffdfbf' },
];

export default function EditProfileModal({ isOpen, onClose, onSuccess }: EditProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state from user
  useEffect(() => {
    if (user) {
      const timer = window.setTimeout(() => {
        setName(user.name || '');
        setAvatar(user.avatar || null);
        setCustomUrl(user.avatar || '');
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [user, isOpen]);

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

  const handleSelectPreset = (url: string) => {
    setAvatar(url);
    setCustomUrl(url);
    setError(null);
  };

  const handleResetToInitials = () => {
    setAvatar(null);
    setCustomUrl('');
    setError(null);
  };

  const handleCustomUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomUrl(val);
    setAvatar(val.trim() ? val.trim() : null);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (updateProfile) {
        await updateProfile({
          name: name.trim(),
          avatar: avatar ? avatar.trim() : null,
        });
      }
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update profile. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const currentInitial = name.trim() ? name.trim().charAt(0).toUpperCase() : 'U';

  return (
    <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <div className={styles.modalTitleIcon}>
              <UserIcon size={18} />
            </div>
            <h2 id="edit-profile-title" className={styles.modalTitle}>Edit Profile</h2>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Close edit profile"
          >
            <X size={17} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className={styles.modalBody}>
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '12.5px', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* Live Avatar Preview */}
          <div className={styles.avatarPreviewSection}>
            <div className={styles.avatarLiveWrap}>
              <GoogleAvatarRing
                initial={currentInitial}
                avatarUrl={avatar || undefined}
                size={76}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                className={styles.cancelBtn}
                style={{ padding: '4px 10px', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onClick={handleResetToInitials}
                title="Use letter initial avatar"
              >
                <RotateCcw size={12} />
                <span>Default Initial</span>
              </button>
            </div>
          </div>

          {/* Display Name Input */}
          <div className={styles.formGroup}>
            <label htmlFor="edit-profile-name" className={styles.formLabel}>
              Full Name
            </label>
            <input
              id="edit-profile-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Enter your name"
              maxLength={60}
              className={styles.formInput}
              required
             aria-label="Enter your name"/>
          </div>

          {/* Preset Avatars Grid */}
          <div className={styles.formGroup}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className={styles.formLabel}>
                Choose Avatar
              </div>
              <span className={styles.formHelp} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={12} /> Quick Presets
              </span>
            </div>
            <div className={styles.avatarPresetGrid}>
              {PRESET_AVATARS.map((preset) => {
                const isSelected = avatar === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`${styles.avatarPresetBtn} ${isSelected ? styles.presetSelected : ''}`}
                    onClick={() => handleSelectPreset(preset.url)}
                    aria-label={`Select avatar ${preset.label}`}
                    title={preset.label}
                  >
                    <img src={preset.url} alt={preset.label} className={styles.presetImg} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Image URL Input */}
          <div className={styles.formGroup}>
            <label htmlFor="edit-profile-custom-url" className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ImageIcon size={14} /> Custom Image URL
            </label>
            <input
              id="edit-profile-custom-url"
              type="url"
              value={customUrl}
              onChange={handleCustomUrlChange}
              placeholder="https://example.com/my-photo.jpg"
              className={styles.formInput}
             aria-label="https://example.com/my-photo.jpg"/>
            <span className={styles.formHelp}>Paste any direct image link or choose a preset above.</span>
          </div>
        </form>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={styles.saveBtn}
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
