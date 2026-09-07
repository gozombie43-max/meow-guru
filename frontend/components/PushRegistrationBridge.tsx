'use client';

import {
  useEffect,
  useRef,
} from 'react';

import api from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';

export default function PushRegistrationBridge() {
  const {
    user,
    loading,
  } = useAuth();

  const lastRegistered =
    useRef<string | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      lastRegistered.current = null;
      return;
    }

    let cancelled = false;

    const register = async (
      fid?: string
    ) => {
      if (
        !fid ||
        cancelled
      ) {
        return;
      }

      const registrationKey =
        `${user.id}:${fid}`;

      if (
        lastRegistered.current ===
        registrationKey
      ) {
        return;
      }

      try {
        await api.post(
          '/api/notifications/register',
          {
            fid,
            platform: 'android',
          }
        );

        if (!cancelled) {
          lastRegistered.current =
            registrationKey;
        }

        console.log(
          'Push registration complete'
        );

      } catch (error) {
        console.error(
          'Push registration failed',
          error
        );
      }
    };

    void register(
      window.__MEOW_FID__
    );

    const handleRegistration = (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent<{
          fid?: string;
        }>;

      void register(
        customEvent.detail?.fid
      );
    };

    window.addEventListener(
      'meow-fcm-registration',
      handleRegistration
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        'meow-fcm-registration',
        handleRegistration
      );
    };
  }, [
    loading,
    user,
  ]);

  return null;
}