'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ScheduledNotificationsPanel from '@/components/admin/ScheduledNotificationsPanel';
import {
  sendBroadcastNotification,
  fetchNotificationHistory,
  fetchNotificationAnalytics,
  fetchNotificationHealth,
  type BroadcastNotificationResult,
  type NotificationHistoryItem,
  type NotificationAnalytics,
  type NotificationHealth,
} from '@/lib/api/adminApi';
import {
  ChevronLeft,
  Send,
  Smartphone,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Users,
  X,
  Radio,
  RotateCw,
  Clock,
  User,
  Navigation,
  Inbox,
  ChevronRight,
} from 'lucide-react';
import s from './AdminNotificationsPage.module.css';

const ROUTE_PRESETS = [
  { label: 'Home', value: '/' },
  { label: 'Mock Tests', value: '/mock-test' },
  { label: 'Daily Quiz', value: '/daily-quiz' },
  { label: 'Dashboard', value: '/dashboard' },
];

function formatHistoryDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

export default function AdminNotificationsPage() {
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
        router.push('/login');
      } else if (!['admin', 'superadmin'].includes(authUser.role || '')) {
        router.push('/');
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

  const handleResetForm = () => {
    setTitle('');
    setBody('');
    setRoute('/');
    setResult(null);
    setError('');
  };

  // ── Auth loading state ─────────────────────────────────
  if (authLoading) {
    return (
      <div className={s.page}>
        <div className={s.loadingWrap}>
          <div className={s.spinnerPage} />
        </div>
      </div>
    );
  }

  if (!authUser || !['admin', 'superadmin'].includes(authUser.role || '')) {
    return null;
  }

  const isFormValid = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className={s.page}>
      {/* ── Header ──────────────────────────────────────── */}
      <header data-ui-chrome="header" className={s.header}>
        <div className={s.headerLeft}>
          <button data-ui-button="icon"
            type="button"
            className={s.backBtn}
            onClick={() => router.push('/admin')}
            title="Back to Admin"
            aria-label="Back to Admin"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <div className={s.headerTitle}>Broadcast Notifications</div>
            <div className={s.headerSubtitle}>
              Push announcements to all registered Android users
            </div>
          </div>
        </div>

        <div className={s.headerRight}>
          <Link href="/admin/users" className={s.navLinkBtn}>
            <Users size={15} />
            <span>Manage Users</span>
          </Link>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────── */}
      <main className={s.content}>
        {/* ── Error Banner ───────────────────────────────── */}
        {error && (
          <div className={s.errorBanner} role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {health && (
          <section className={s.resultCard} aria-live="polite">
            <div className={s.resultHeader}>
              <div className={s.resultTitleRow}>
                {health.status === 'healthy' ? (
                  <CheckCircle className={s.resultSuccessIcon} size={22} />
                ) : (
                  <AlertTriangle className={s.resultWarningIcon} size={22} />
                )}
                <h2
                  className={`${s.resultTitle} ${
                    health.status === 'healthy' ? '' : s.resultWarningTitle
                  }`}
                >
                  Notification Operations
                </h2>
              </div>
            </div>

            <div className={s.statsGrid}>
              <div className={s.statBox}>
                <div className={s.statBoxValue}>{health.status}</div>
                <div className={s.statBoxLabel}>Overall</div>
              </div>
              <div className={s.statBox}>
                <div className={s.statBoxValue}>
                  {health.workers.filter((worker) => worker.state === 'healthy').length}/3
                </div>
                <div className={s.statBoxLabel}>Workers healthy</div>
              </div>
              <div className={s.statBox}>
                <div className={s.statBoxValue}>{health.scheduled.overduePending}</div>
                <div className={s.statBoxLabel}>Overdue jobs</div>
              </div>
              <div className={s.statBox}>
                <div className={s.statBoxValue}>{health.push24h.failureRatePercent}%</div>
                <div className={s.statBoxLabel}>FCM failures · 24h</div>
              </div>
            </div>

            <div className={s.noticeBox} style={{ marginTop: 16 }}>
              <div className={s.noticeText}>
                {health.workers.map((worker) => (
                  <div key={worker.workerName}>
                    <strong>{worker.workerName}</strong>
                    {' — '}{worker.state}
                    {typeof worker.ageSeconds === 'number' && ` · ${worker.ageSeconds}s ago`}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Result Card ────────────────────────────────── */}
        {result && (
          <section className={s.resultCard} aria-live="polite">
            <div className={s.resultHeader}>
              <div className={s.resultTitleRow}>
                <CheckCircle className={s.resultSuccessIcon} size={22} />
                <h2 className={s.resultTitle}>Sent successfully</h2>
              </div>
              <button data-ui-button="state"
                type="button"
                className={s.closeResultBtn}
                onClick={() => setResult(null)}
                title="Dismiss result"
                aria-label="Dismiss result"
              >
                <X size={18} />
              </button>
            </div>

            <div className={s.statsGrid}>
              <div className={s.statBox}>
                <div className={s.statBoxValue}>{result.totalDevices}</div>
                <div className={s.statBoxLabel}>Registered devices</div>
              </div>

              <div className={`${s.statBox} ${s.statDelivered}`}>
                <div className={s.statBoxValue}>{result.successCount}</div>
                <div className={s.statBoxLabel}>FCM Accepted</div>
              </div>

              <div className={`${s.statBox} ${s.statFailed}`}>
                <div className={s.statBoxValue}>{result.failureCount}</div>
                <div className={s.statBoxLabel}>Failed</div>
              </div>

              <div className={`${s.statBox} ${s.statInvalid}`}>
                <div className={s.statBoxValue}>
                  {result.invalidDeviceCount ?? 0}
                </div>
                <div className={s.statBoxLabel}>Invalid devices</div>
              </div>
            </div>
          </section>
        )}

        {/* ── Analytics Performance Section ──────────────── */}
        <section className={s.analyticsSection} aria-label="Notification Performance">
          <div className={s.analyticsHeader}>
            <div className={s.analyticsTitleRow}>
              <h2 className={s.analyticsTitle}>
                Notification Performance · Last 30 days
              </h2>
            </div>
            <button data-ui-button="secondary"
              type="button"
              className={s.refreshBtn}
              onClick={() => loadAnalytics(30)}
              disabled={analyticsLoading}
              title="Refresh analytics"
              aria-label="Refresh analytics"
            >
              <RotateCw size={14} className={analyticsLoading ? s.spinIcon : ''} />
              <span>Refresh</span>
            </button>
          </div>

          <div className={s.statsGrid}>
            <div className={s.statBox}>
              <div className={`${s.statBoxValue} ${s.statAcceptedVal}`}>
                {analytics ? analytics.acceptedCount.toLocaleString() : '0'}
              </div>
              <div className={s.statBoxLabel}>FCM Accepted</div>
            </div>

            <div className={s.statBox}>
              <div className={s.statBoxValue}>
                {analytics ? analytics.opened.toLocaleString() : '0'}
              </div>
              <div className={s.statBoxLabel}>Unique Opens</div>
              <div className={s.statBoxRate}>
                {analytics ? `${analytics.openRate}%` : '0%'}
              </div>
            </div>

            <div className={s.statBox}>
              <div className={s.statBoxValue}>
                {analytics ? analytics.pushOpened.toLocaleString() : '0'}
              </div>
              <div className={s.statBoxLabel}>Android Push Opens</div>
            </div>

            <div className={s.statBox}>
              <div className={s.statBoxValue}>
                {analytics ? analytics.inAppOpened.toLocaleString() : '0'}
              </div>
              <div className={s.statBoxLabel}>Notification Center Opens</div>
            </div>

            <div className={s.statBox}>
              <div className={s.statBoxValue}>
                {analytics ? analytics.actionClicked.toLocaleString() : '0'}
              </div>
              <div className={s.statBoxLabel}>Action Clicks</div>
              <div className={s.statBoxRate}>
                {analytics ? `${analytics.actionRate}%` : '0%'}
              </div>
            </div>

            <div className={s.statBox}>
              <div className={`${s.statBoxValue} ${s.statFailedVal}`}>
                {analytics ? analytics.failureCount.toLocaleString() : '0'}
              </div>
              <div className={s.statBoxLabel}>FCM Failed</div>
            </div>
          </div>
        </section>

        <div className={s.grid}>
          {/* ── Left Column: Form ────────────────────────── */}
          <div className={s.card}>
            <h1 className={s.cardTitle}>
              <Radio size={18} color="#3b82f6" />
              Compose Push Notification
            </h1>
            <p className={s.cardSubtitle}>
              Broadcast an instant push message to active Android devices with notifications enabled.
            </p>

            <div className={s.noticeBox}>
              <Smartphone className={s.noticeIcon} size={18} />
              <div className={s.noticeText}>
                <strong>Target audience:</strong> Registered Android app users with notifications enabled. Website-only users or devices without push tokens will not receive it.
              </div>
            </div>

            <form onSubmit={handleOpenConfirm}>
              {/* Title Field */}
              <div className={s.formGroup}>
                <div className={s.labelRow}>
                  <label htmlFor="notif-title" className={s.label}>
                    Title
                  </label>
                  <span
                    className={`${s.charCount} ${
                      title.length > 90 ? s.charCountWarn : ''
                    }`}
                  >
                    {title.length}/100
                  </span>
                </div>
                <input
                  id="notif-title"
                  type="text"
                  className={s.input}
                  placeholder="New Mock Test 🔥"
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  aria-label="Notification title"
                />
                <div className={s.inputHelp}>
                  Catchy headline visible in Android status bar & notification shade.
                </div>
              </div>

              {/* Body Field */}
              <div className={s.formGroup}>
                <div className={s.labelRow}>
                  <label htmlFor="notif-body" className={s.label}>
                    Message Body
                  </label>
                  <span
                    className={`${s.charCount} ${
                      body.length > 450 ? s.charCountWarn : ''
                    }`}
                  >
                    {body.length}/500
                  </span>
                </div>
                <textarea
                  id="notif-body"
                  className={s.textarea}
                  placeholder="SSC CGL Mock Test 12 is now available."
                  value={body}
                  maxLength={500}
                  rows={4}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  aria-label="Notification message"
                />
                <div className={s.inputHelp}>
                  Detailed message describing the announcement or release.
                </div>
              </div>

              {/* Route Field */}
              <div className={s.formGroup}>
                <div className={s.labelRow}>
                  <label htmlFor="notif-route" className={s.label}>
                    Target App Route
                  </label>
                </div>
                <input
                  id="notif-route"
                  type="text"
                  className={s.input}
                  placeholder="/mock-test"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  aria-label="Notification target route"
                />
                <div className={s.presetsWrap}>
                  <span className={s.presetLabel}>Quick Presets:</span>
                  {ROUTE_PRESETS.map((preset) => (
                    <button data-ui-button="state"
                      key={preset.value}
                      type="button"
                      className={`${s.presetChip} ${
                        route === preset.value ? s.presetChipActive : ''
                      }`}
                      onClick={() => setRoute(preset.value)}
                    >
                      {preset.label} ({preset.value})
                    </button>
                  ))}
                </div>
                <div className={s.inputHelp}>
                  The screen or URL path opened when the user taps the notification. Default is &ldquo;/&rdquo;.
                </div>
              </div>

              {/* Action Buttons */}
              <button data-ui-button="primary"
                type="submit"
                className={s.submitBtn}
                disabled={!isFormValid || isSubmitting}
              >
                <Send size={16} />
                <span>Review &amp; Broadcast to All Users</span>
              </button>
            </form>
          </div>

          {/* ── Right Column: Live Android Preview ──────── */}
          <div>
            <div className={s.previewContainer}>
              <div className={s.previewHeader}>
                <span>Live Android Preview</span>
                <span className={s.previewBadge}>Mockup</span>
              </div>

              <div className={s.mockPhone}>
                <div className={s.mockPhoneHeader}>
                  <div className={s.mockPhoneApp}>
                    <div className={s.mockAppIcon}>Q</div>
                    <span className={s.mockAppName}>QuizGuru</span>
                  </div>
                  <span className={s.mockTimestamp}>Now</span>
                </div>

                <div className={s.mockNotificationTitle}>
                  {title.trim() || 'New Mock Test 🔥'}
                </div>
                <div className={s.mockNotificationBody}>
                  {body.trim() || 'SSC CGL Mock Test 12 is now available.'}
                </div>

                <div className={s.mockNotificationRoute}>
                  Opens: {route.trim() || '/'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent Notifications History Section ────────── */}
        <section className={s.historySection} aria-label="Notification History">
          <div className={s.historyHeader}>
            <div className={s.historyTitleGroup}>
              <h2 className={s.historyTitle}>
                <Clock size={19} color="#3b82f6" />
                <span>Recent Notifications</span>
              </h2>
              {historyTotal > 0 && (
                <span className={s.historyCountBadge}>
                  {historyTotal} {historyTotal === 1 ? 'broadcast' : 'broadcasts'}
                </span>
              )}
            </div>
            <button data-ui-button="secondary"
              type="button"
              className={s.refreshBtn}
              onClick={() => loadHistory(historyPage)}
              disabled={historyLoading}
              title="Refresh history"
              aria-label="Refresh history"
            >
              <RotateCw size={13} className={historyLoading ? s.spinner : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {historyError && (
            <div className={s.errorBanner} role="alert">
              <AlertCircle size={16} />
              <span>{historyError}</span>
            </div>
          )}

          {historyLoading && historyItems.length === 0 ? (
            <div className={s.historyEmptyState}>
              <div className={s.spinnerPage} style={{ margin: '0 auto 12px' }} />
              <div className={s.emptyStateText}>Loading broadcast history...</div>
            </div>
          ) : historyItems.length === 0 ? (
            <div className={s.historyEmptyState}>
              <Inbox className={s.emptyStateIcon} size={40} />
              <div className={s.emptyStateTitle}>No notifications sent yet</div>
              <div className={s.emptyStateText}>
                Broadcast messages sent to registered Android devices will appear here.
              </div>
            </div>
          ) : (
            <div className={s.historyList}>
              {historyItems.map((item) => (
                <article key={item._id} className={s.historyCard}>
                  <div className={s.historyCardTop}>
                    <div className={s.historyTitleWrap}>
                      <h3 className={s.historyCardTitle}>{item.title}</h3>
                      {item.type === 'new-mock' ? (
                        <span className={s.typeBadgeAuto}>🎯 Auto — New Mock</span>
                      ) : item.type === 'scheduled-broadcast' ? (
                        <span className={s.typeBadgeScheduled}>⏰ Scheduled</span>
                      ) : (
                        <span className={s.typeBadgeBroadcast}>📢 Broadcast</span>
                      )}
                    </div>
                    <time className={s.historyCardDate} dateTime={item.createdAt}>
                      {formatHistoryDate(item.createdAt)}
                    </time>
                  </div>

                  <p className={s.historyCardBody}>{item.body}</p>

                  <div className={s.historyMetaRow}>
                    <div className={s.metaPill}>
                      <span className={s.metaSuccess}>
                        <CheckCircle size={14} />
                      </span>
                      <span>
                        Sent: <strong>{item.successCount}</strong> / {item.totalDevices}
                      </span>
                    </div>

                    <div className={s.metaPill}>
                      <span className={item.failureCount > 0 ? s.metaFailure : ''}>
                        {item.failureCount > 0 && <AlertCircle size={14} />}
                        Failed: <strong>{item.failureCount}</strong>
                      </span>
                    </div>

                    {item.invalidDeviceCount > 0 && (
                      <div className={s.metaPill}>
                        <span>
                          Invalid: <strong>{item.invalidDeviceCount}</strong>
                        </span>
                      </div>
                    )}

                    <div className={s.metaPill}>
                      <User size={13} />
                      <span>
                        By: <strong>{item.type === 'new-mock' ? 'System (Auto)' : (item.sentByEmail || item.sentByUserId || 'Admin')}</strong>
                      </span>
                    </div>

                    <div className={s.metaPill}>
                      <Navigation size={13} />
                      <span className={s.metaRouteBadge}>
                        {item.route || '/'}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {historyTotalPages > 1 && (
            <div className={s.historyPagination}>
              <span className={s.pageInfo}>
                Page {historyPage} of {historyTotalPages} ({historyTotal} total)
              </span>
              <div className={s.paginationControls}>
                <button data-ui-button="secondary"
                  type="button"
                  className={s.paginationBtn}
                  onClick={() => loadHistory(historyPage - 1)}
                  disabled={historyPage <= 1 || historyLoading}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button data-ui-button="secondary"
                  type="button"
                  className={s.paginationBtn}
                  onClick={() => loadHistory(historyPage + 1)}
                  disabled={historyPage >= historyTotalPages || historyLoading}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Scheduled Notifications Management ─────────── */}
        <ScheduledNotificationsPanel />
      </main>

      {/* ── Confirmation Modal Dialog ────────────────────── */}
      {isConfirmOpen && (
        <div
          className={s.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div
            className={s.modalDialog}
          >
            <div data-ui-chrome="header" className={s.modalHeader}>
              <div className={s.modalIconWrap}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 id="confirm-modal-title" className={s.modalTitle}>
                  Send notification to all registered Android users?
                </h3>
                <p className={s.modalSubtitle}>
                  This action will dispatch an immediate push broadcast.
                </p>
              </div>
            </div>

            <div className={s.modalBody}>
              <div className={s.summaryBox}>
                <div className={s.summaryRow}>
                  <span className={s.summaryLabel}>Title:</span>
                  <span className={s.summaryValue}>{title.trim()}</span>
                </div>
                <div className={s.summaryRow}>
                  <span className={s.summaryLabel}>Recipients:</span>
                  <span className={s.summaryValue}>
                    All registered devices
                  </span>
                </div>
                <div className={s.summaryRow}>
                  <span className={s.summaryLabel}>Route:</span>
                  <span className={s.summaryValue}>
                    {route.trim() || '/'}
                  </span>
                </div>
              </div>
            </div>

            <div className={s.modalActions}>
              <button data-ui-button="secondary"
                type="button"
                className={s.cancelBtn}
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button data-ui-button="primary"
                type="button"
                className={s.confirmSendBtn}
                onClick={handleSendBroadcast}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className={s.spinner} />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
