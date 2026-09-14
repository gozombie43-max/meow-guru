'use client';

import { useAuth } from '@/context/AuthContext';
import {
  fetchNotificationAnalytics,
  fetchNotificationHealth,
  fetchNotificationHistory,
  sendBroadcastNotification,
  type BroadcastNotificationResult,
  type NotificationAnalytics,
  type NotificationHealth,
  type NotificationHistoryItem,
} from '@/lib/api/adminApi';
import { useRouter } from 'next/navigation';
import { useCallback,useEffect,useState } from 'react';

export function useAdminNotifications() {
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // Form inputs
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [route, setRoute] = useState('/');

  // Broadcast states
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BroadcastNotificationResult | null>(null);

  // History states
  const [historyItems, setHistoryItems] = useState<NotificationHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // Analytics states
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Operations health state
  const [health, setHealth] = useState<NotificationHealth | null>(null);

  // ── Auth guard ─────────────────────────────────────────
  useEffect(() => {
    if (!authLoading) {
      if (!authUser) {
        router.replace('/login');
      } else if (!['admin', 'superadmin'].includes(authUser.role || '')) {
        router.replace('/');
      }
    }
  }, [authUser, authLoading, router]);

  // ── History fetcher ───────────────────────────────────
  const loadHistory = useCallback(async (pageNumber = 1) => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await fetchNotificationHistory(pageNumber);
      setHistoryItems(res.items || []);
      setHistoryTotal(res.total || 0);
      setHistoryPage(res.page || pageNumber);
      setHistoryTotalPages(res.totalPages || 1);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        'Failed to load notification history.';
      setHistoryError(msg);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // ── Analytics fetcher ─────────────────────────────────
  const loadAnalytics = useCallback(async (days = 30) => {
    setAnalyticsLoading(true);
    try {
      const res = await fetchNotificationAnalytics(days);
      setAnalytics(res);
    } catch (err: unknown) {
      console.error('Failed to load notification analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      setHealth(await fetchNotificationHealth());
    } catch {
      // Health monitoring must not make the admin workflow unusable.
    }
  }, []);

  useEffect(() => {
    if (authUser && ['admin', 'superadmin'].includes(authUser.role || '')) {
      const timer = window.setTimeout(() => {
        void loadHistory(1);
        void loadAnalytics(30);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [authUser, loadHistory, loadAnalytics]);

  useEffect(() => {
    if (!authUser || !['admin', 'superadmin'].includes(authUser.role || '')) {
      return;
    }

    const initialTimer = window.setTimeout(() => void loadHealth(), 0);
    const timer = window.setInterval(() => {
      void loadHealth();
    }, 60_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [authUser, loadHealth]);

  // ── Handlers ───────────────────────────────────────────
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      setError('Please provide a notification title.');
      return;
    }
    if (trimmedTitle.length > 100) {
      setError('Title cannot exceed 100 characters.');
      return;
    }
    if (!trimmedBody) {
      setError('Please provide a notification body message.');
      return;
    }
    if (trimmedBody.length > 500) {
      setError('Body cannot exceed 500 characters.');
      return;
    }

    setIsConfirmOpen(true);
  };

  const handleSendBroadcast = useCallback(async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const res = await sendBroadcastNotification({
        title: title.trim(),
        body: body.trim(),
        route: route.trim() || '/',
      });

      setResult(res);
      setIsConfirmOpen(false);
      // Refresh history and analytics to show the newly dispatched notification
      loadHistory(1);
      loadAnalytics(30);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        'Failed to dispatch broadcast notification.';
      setError(msg);
      setIsConfirmOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [title, body, route, loadHistory, loadAnalytics]);

  return { authUser, authLoading, router, title, setTitle, body, setBody, route, setRoute, isConfirmOpen, setIsConfirmOpen, isSubmitting, error, result, setResult, historyItems, historyTotal, historyPage, historyTotalPages, historyLoading, historyError, analytics, analyticsLoading, health, loadHistory, loadAnalytics, handleOpenConfirm, handleSendBroadcast };
}
