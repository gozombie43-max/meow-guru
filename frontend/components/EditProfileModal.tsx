'use client';

import { Dialog } from "@/components/ui/Dialog";
import React, { useState, useEffect, useRef } from 'react';
import { X, Check, User as UserIcon, Sparkles, Loader2, RotateCcw, Upload } from 'lucide-react';
import GoogleAvatarRing from './GoogleAvatarRing';
import { useAuth } from '@/context/AuthContext';
import styles from './UserProfileMenu.module.css';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
const DIRECT_DATA_URL_MAX_BYTES = 64 * 1024;
const AVATAR_CANVAS_SIZE = 160;

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}

async function readLocalAvatarFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  if (file.size <= DIRECT_DATA_URL_MAX_BYTES || typeof document === 'undefined') {
    return dataUrl;
  }

  let ctx: CanvasRenderingContext2D | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!canvas || !ctx) {
    return dataUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const minSide = Math.min(img.width || AVATAR_CANVAS_SIZE, img.height || AVATAR_CANVAS_SIZE);
        const sx = Math.max(0, ((img.width || minSide) - minSide) / 2);
        const sy = Math.max(0, ((img.height || minSide) - minSide) / 2);
        canvas.width = AVATAR_CANVAS_SIZE;
        canvas.height = AVATAR_CANVAS_SIZE;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, AVATAR_CANVAS_SIZE, AVATAR_CANVAS_SIZE);
        const webp = canvas.toDataURL('image/webp', 0.85);
        resolve(webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Invalid image file.'));
    img.src = dataUrl;
  });
}

export default function EditProfileModal({ isOpen, onClose, onSuccess }: EditProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form state from user
  useEffect(() => {
    if (user) {
      const timer = window.setTimeout(() => {
        setName(user.name || '');
        setAvatar(user.avatar || null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSelectPreset = (url: string) => {
    setAvatar(url);
    setError(null);
  };

  const handleResetToInitials = () => {
    setAvatar(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLocalFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }
    if (file.size > MAX_AVATAR_FILE_BYTES) {
      setError('Image must be smaller than 5 MB.');
      return;
    }

    try {
      const processedDataUrl = await readLocalAvatarFile(file);
      setAvatar(processedDataUrl);
      setError(null);
    } catch {
      setError('Unable to load the selected image. Please try another file.');
    }
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
    <Dialog onClose={onClose} busy={saving} className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
      <div className={styles.modalCard}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleGroup}>
            <div className={styles.modalTitleIcon}>
              <UserIcon size={18} />
            </div>
            <h2 id="edit-profile-title" className={styles.modalTitle}>Edit Profile</h2>
          </div>
          <button data-ui-button="icon"
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
            <div className={styles.errorBanner} role="alert">
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleLocalFileChange}
              style={{ display: 'none' }}
              aria-label="Upload profile image"
            />
            <div className={styles.avatarActions}>
              <button data-ui-button="state"
                type="button"
                className={styles.avatarActionBtn}
                onClick={() => fileInputRef.current?.click()}
                title="Upload image from your device"
              >
                <Upload size={14} />
                <span>Upload Photo</span>
              </button>
              <button data-ui-button="state"
                type="button"
                className={styles.avatarActionBtn}
                onClick={handleResetToInitials}
                title="Use letter initial avatar"
              >
                <RotateCcw size={14} />
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
              aria-label="Enter your name"
            />
          </div>

          {/* Preset Avatars Grid */}
          <div className={styles.formGroup}>
            <div className={styles.formLabelRow}>
              <span className={styles.formLabel}>
                Choose Avatar
              </span>
              <span className={styles.formBadge}>
                <Sparkles size={12} /> Quick Presets
              </span>
            </div>
            <div className={styles.avatarPresetGrid}>
              {PRESET_AVATARS.map((preset) => {
                const isSelected = avatar === preset.url;
                return (
                  <button data-ui-button="state"
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
        </form>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button data-ui-button="secondary"
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button data-ui-button="primary"
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
    </Dialog>
  );
}
