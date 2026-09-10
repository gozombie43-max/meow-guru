'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchScheduledNotifications,
  cancelScheduledNotification,
  retryScheduledNotification,
  type ScheduledNotificationItem,
  type ScheduledNotificationStatus,
} from '@/lib/api/adminApi';
import {
  CalendarClock,
  RotateCw,
  Ban,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  AlertCircle,
  Inbox,
  Navigation,
} from 'lucide-react';
import s from './ScheduledNotificationsPanel.module.css';

type TabType = 'pending' | 'sent' | 'failed' | 'cancelled' | 'all';

function formatScheduleDate(dateStr?: string): string {
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
  return `${datePart} • ${timePart}`;
}

export default function ScheduledNotificationsPanel() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [items, setItems] = useState<ScheduledNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [counts, setCounts] = useState({
    pending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
  });

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [retryTargetItem, setRetryTargetItem] =
    useState<ScheduledNotificationItem | null>(null);

  const loadScheduled = useCallback(async (tab: TabType) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchScheduledNotifications(
        tab === 'all' ? 'all' : (tab as ScheduledNotificationStatus),
        1
      );
      setItems(res.items || []);
      if (res.counts) {
        setCounts(res.counts);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        'Failed to load scheduled notifications.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadScheduled(activeTab), 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadScheduled]);

  const handleCancel = async (item: ScheduledNotificationItem) => {
    if (actionLoadingId) return;
    setActionLoadingId(item._id);
    try {
      await cancelScheduledNotification(item._id);
      await loadScheduled(activeTab);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Failed to cancel scheduled notification.';
      alert(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmRetry = async () => {
    if (!retryTargetItem || actionLoadingId) return;
    const targetId = retryTargetItem._id;
    setActionLoadingId(targetId);
    try {
      await retryScheduledNotification(targetId);
      setRetryTargetItem(null);
      await loadScheduled(activeTab);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Failed to retry scheduled notification.';
      alert(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusClass = (st: string) => {
    switch (st) {
      case 'pending':
        return s.statusPending;
      case 'processing':
        return s.statusProcessing;
      case 'sent':
        return s.statusSent;
      case 'failed':
        return s.statusFailed;
      case 'cancelled':
        return s.statusCancelled;
      default:
        return '';
    }
  };

  return (
    <section className={s.container} aria-label="Scheduled Notifications">
      <div className={s.header}>
        <div className={s.titleGroup}>
          <h2 className={s.title}>
            <CalendarClock size={20} color="#3b82f6" />
            <span>Scheduled Notifications</span>
          </h2>
        </div>
        <button data-ui-button="secondary"
          type="button"
          className={s.refreshBtn}
          onClick={() => loadScheduled(activeTab)}
          disabled={loading}
          title="Refresh scheduled list"
          aria-label="Refresh scheduled list"
        >
          <RotateCw size={13} className={loading ? s.spinner : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Tabs */}
      <div className={s.tabs} role="tablist" aria-label="Notification status">
        <button data-ui-button="state"
          type="button"
          role="tab"
          aria-selected={activeTab === 'pending'}
          className={`${s.tabBtn} ${activeTab === 'pending' ? s.tabActive : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <span>Upcoming</span>
          <span className={s.tabCount}>{counts.pending}</span>
        </button>

        <button data-ui-button="state"
          type="button"
          role="tab"
          aria-selected={activeTab === 'sent'}
          className={`${s.tabBtn} ${activeTab === 'sent' ? s.tabActive : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          <span>Sent</span>
          <span className={s.tabCount}>{counts.sent}</span>
        </button>

        <button data-ui-button="state"
          type="button"
          role="tab"
          aria-selected={activeTab === 'failed'}
          className={`${s.tabBtn} ${activeTab === 'failed' ? s.tabActive : ''}`}
          onClick={() => setActiveTab('failed')}
        >
          <span>Failed</span>
          <span className={s.tabCount}>{counts.failed}</span>
        </button>

        <button data-ui-button="state"
          type="button"
          role="tab"
          aria-selected={activeTab === 'cancelled'}
          className={`${s.tabBtn} ${activeTab === 'cancelled' ? s.tabActive : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          <span>Cancelled</span>
          <span className={s.tabCount}>{counts.cancelled}</span>
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '12px 14px',
            marginBottom: '16px',
            borderRadius: '10px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            fontSize: '13px',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Cards List */}
      {loading && items.length === 0 ? (
        <div className={s.emptyState}>
          <div className={s.spinner} style={{ margin: '0 auto 10px', width: 24, height: 24 }} />
          <div className={s.emptyText}>Loading scheduled notifications...</div>
        </div>
      ) : items.length === 0 ? (
        <div className={s.emptyState}>
          <Inbox className={s.emptyIcon} size={36} />
          <div className={s.emptyTitle}>
            {activeTab === 'pending'
              ? 'No upcoming notifications scheduled'
              : activeTab === 'failed'
              ? 'No failed notifications'
              : `No ${activeTab} notifications`}
          </div>
          <div className={s.emptyText}>
            {activeTab === 'pending'
              ? 'Scheduled broadcasts will appear here before their target send time.'
              : 'Items in this category will be listed here.'}
          </div>
        </div>
      ) : (
        <div className={s.cardList}>
          {items.map((item) => (
            <article key={item._id} className={s.card}>
              <div className={s.cardTop}>
                <h3 className={s.cardTitle}>{item.title}</h3>
                <span className={`${s.statusBadge} ${statusClass(item.status)}`}>
                  {item.status}
                </span>
              </div>

              <p className={s.cardBody}>{item.body}</p>

              <div className={s.cardMeta}>
                {item.status === 'pending' && (
                  <div className={s.metaItem}>
                    <Clock size={13} />
                    <span>{formatScheduleDate(item.sendAt)}</span>
                  </div>
                )}

                {item.status === 'sent' && item.sentAt && (
                  <div className={s.metaItem}>
                    <CheckCircle size={13} color="#10b981" />
                    <span>Sent: {formatScheduleDate(item.sentAt)}</span>
                  </div>
                )}

                {item.status === 'failed' && (
                  <>
                    <div className={`${s.metaItem} ${s.metaError}`}>
                      <AlertCircle size={13} />
                      <span>Failed: {item.error || 'Delivery failed'}</span>
                    </div>
                    <div className={s.metaItem}>
                      <span>Attempts: {item.attempts ?? 1}</span>
                    </div>
                  </>
                )}

                {item.status === 'cancelled' && item.cancelledAt && (
                  <div className={s.metaItem}>
                    <Ban size={13} />
                    <span>Cancelled: {formatScheduleDate(item.cancelledAt)}</span>
                  </div>
                )}

                <div className={s.metaItem}>
                  <Navigation size={12} />
                  <span className={s.metaRoute}>Route: {item.route || '/'}</span>
                </div>
              </div>

              {/* Actions */}
              {item.status === 'pending' && (
                <div className={s.cardActions}>
                  <button data-ui-button="secondary"
                    type="button"
                    className={s.cancelActionBtn}
                    onClick={() => handleCancel(item)}
                    disabled={actionLoadingId === item._id}
                  >
                    <Ban size={12} />
                    <span>
                      {actionLoadingId === item._id ? 'Cancelling...' : 'Cancel'}
                    </span>
                  </button>
                </div>
              )}

              {item.status === 'failed' && (
                <div className={s.cardActions}>
                  <button data-ui-button="secondary"
                    type="button"
                    className={s.retryActionBtn}
                    onClick={() => setRetryTargetItem(item)}
                    disabled={actionLoadingId === item._id}
                  >
                    <RotateCcw size={12} />
                    <span>Retry</span>
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Retry Confirmation Modal */}
      {retryTargetItem && (
        <div
          className={s.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="retry-modal-title"
        >
          <div
            className={s.modalDialog}
          >
            <div data-ui-chrome="header" className={s.modalHeader}>
              <div className={s.modalIconWrap}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 id="retry-modal-title" className={s.modalTitle}>
                  Retry failed notification?
                </h3>
              </div>
            </div>

            <div className={s.modalMessage}>
              <p>
                This notification previously failed or was interrupted. Retrying may occasionally result in a duplicate push. Retry anyway?
              </p>
              <div className={s.modalWarningNotice}>
                <strong>Target Notification:</strong> &ldquo;{retryTargetItem.title}&rdquo;
              </div>
            </div>

            <div className={s.modalActions}>
              <button data-ui-button="secondary"
                type="button"
                className={s.modalCancelBtn}
                onClick={() => setRetryTargetItem(null)}
                disabled={Boolean(actionLoadingId)}
              >
                Cancel
              </button>
              <button data-ui-button="primary"
                type="button"
                className={s.modalConfirmRetryBtn}
                onClick={handleConfirmRetry}
                disabled={Boolean(actionLoadingId)}
              >
                {actionLoadingId === retryTargetItem._id ? (
                  <>
                    <div className={s.spinner} />
                    <span>Scheduling Retry...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={13} />
                    <span>Retry Anyway</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
