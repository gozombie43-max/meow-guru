'use client';

import s from '@/app/(admin)/admin/notifications/AdminNotificationsPage.module.css';
import { useAdminNotifications } from '@/features/notifications/admin/useAdminNotifications';
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Navigation,
  RotateCw,
  User
} from 'lucide-react';

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

type Props = Pick<ReturnType<typeof useAdminNotifications>, 'historyItems' | 'historyTotal' | 'historyPage' | 'historyTotalPages' | 'historyLoading' | 'historyError' | 'loadHistory'>;
export function NotificationHistory({ historyItems, historyTotal, historyPage, historyTotalPages, historyLoading, historyError, loadHistory }: Props) { return <>
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

</>; }
