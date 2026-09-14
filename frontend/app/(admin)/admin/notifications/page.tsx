'use client';
import { NotificationAnalyticsPanel } from '@/features/notifications/admin/NotificationAnalyticsPanel';
import { NotificationHistory } from '@/features/notifications/admin/NotificationHistory';

import ScheduledNotificationsPanel from '@/components/admin/ScheduledNotificationsPanel';
import { useAdminNotifications } from '@/features/notifications/admin/useAdminNotifications';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  Radio,
  Send,
  Smartphone,
  Users,
  X
} from 'lucide-react';
import Link from 'next/link';
import s from './AdminNotificationsPage.module.css';

const ROUTE_PRESETS = [
  { label: 'Home', value: '/' },
  { label: 'Mock Tests', value: '/mock-test' },
  { label: 'Daily Quiz', value: '/daily-quiz' },
  { label: 'Dashboard', value: '/dashboard' },
];

export default function AdminNotificationsPage() {
  const { authUser, authLoading, router, title, setTitle, body, setBody, route, setRoute, isConfirmOpen, setIsConfirmOpen, isSubmitting, error, result, setResult, historyItems, historyTotal, historyPage, historyTotalPages, historyLoading, historyError, analytics, analyticsLoading, health, loadHistory, loadAnalytics, handleOpenConfirm, handleSendBroadcast } = useAdminNotifications();
  if (authLoading) return <div className={s.page}><div className={s.loadingWrap}><div className={s.spinnerPage} /></div></div>;
  if (!authUser || !['admin', 'superadmin'].includes(authUser.role || '')) return null;
  const isFormValid = title.trim().length > 0 && body.trim().length > 0;


  return (
    <div className={s.page}>
      {/* ── Header ──────────────────────────────────────── */}
      <header data-ui-chrome="header" className={s.header}>
        <div className={s.headerLeft}>
          <button data-ui-button="icon"
            type="button"
            className={s.backBtn}
            onClick={() => router.replace('/admin')}
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
              <button data-ui-button="state" data-ui-shape="icon"
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

        <NotificationAnalyticsPanel analytics={analytics} analyticsLoading={analyticsLoading} loadAnalytics={loadAnalytics} />
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

        <NotificationHistory historyItems={historyItems} historyTotal={historyTotal} historyPage={historyPage} historyTotalPages={historyTotalPages} historyLoading={historyLoading} historyError={historyError} loadHistory={loadHistory} />
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
