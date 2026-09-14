'use client';

import s from '@/app/(admin)/admin/notifications/AdminNotificationsPage.module.css';
import { useAdminNotifications } from '@/features/notifications/admin/useAdminNotifications';
import {
  RotateCw
} from 'lucide-react';


type Props = Pick<ReturnType<typeof useAdminNotifications>, 'analytics' | 'analyticsLoading' | 'loadAnalytics'>;
export function NotificationAnalyticsPanel({ analytics, analyticsLoading, loadAnalytics }: Props) { return <>
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

</>; }
