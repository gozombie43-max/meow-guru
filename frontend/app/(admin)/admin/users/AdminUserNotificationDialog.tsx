"use client";

import { Dialog } from "@/components/ui/Dialog";

import { CheckCircle } from 'lucide-react';
import s from './AdminUsersPage.module.css';
import type { AdminUsersView } from './useAdminUsers';
export function AdminUserNotificationDialog({ view }: { view: AdminUsersView }) {
 const { selectedUser, showNotifyModal, setShowNotifyModal, actionLoading, notifyTitle, setNotifyTitle, notifyBody, setNotifyBody, notifyResult, setNotifyResult, handleNotify } = view;
 return (<>{showNotifyModal && selectedUser && (
        <Dialog onClose={() => { setShowNotifyModal(false); setNotifyResult(null); }} busy={actionLoading} className={s.modal} role="dialog" aria-modal="true" aria-labelledby="notify-user-title">
          <div className={s.modalCard}>
            <div id="notify-user-title" className={s.modalTitle}>
              Send Notification to {selectedUser.name}
            </div>
            {!notifyResult && <>
              <div className={s.notifyCapability}>
                <div><CheckCircle size={16} /><span>Notification Center</span></div>
                {selectedUser.push?.androidRegistered ? (
                  <div><CheckCircle size={16} /><span>Android FCM push</span></div>
                ) : (
                  <div className={s.notifyUnavailable}>— Android push unavailable</div>
                )}
              </div>
              <input
                className={s.modalInput}
                placeholder="Title (e.g. Your SSC CGL mock is ready)"
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
               aria-label="Title (e.g. Your SSC CGL mock is ready)"/>
              <textarea
                className={s.modalInput}
                style={{ minHeight: 80, resize: 'vertical' }}
                placeholder="Body message..."
                value={notifyBody}
                onChange={(e) => setNotifyBody(e.target.value)}
               aria-label="Body message..."/>
            </>}
            {notifyResult && (
              <div className={s.notifyResult}>
                <div><CheckCircle size={16} /> Notification Center saved</div>
                {notifyResult.sent ? (
                  <div><CheckCircle size={16} /> FCM Accepted: {notifyResult.successCount} Android device{notifyResult.successCount === 1 ? '' : 's'}</div>
                ) : notifyResult.noDevices ? (
                  <div className={s.notifyWarning}>In-app only — no Android device</div>
                ) : notifyResult.suppressed ? (
                  <div className={s.notifyWarning}>Push disabled by user</div>
                ) : (
                  <div className={s.notifyFailed}>FCM Failed</div>
                )}
                {notifyResult.failureCount > 0 && <div className={s.notifyFailed}>Failed: {notifyResult.failureCount}</div>}
                {notifyResult.invalidDeviceCount > 0 && <div className={s.notifyFailed}>Invalid devices: {notifyResult.invalidDeviceCount}</div>}
              </div>
            )}
            <div className={s.modalActions}>
              <button data-ui-button="secondary"
                className={s.modalBtnSecondary}
                onClick={() => { setShowNotifyModal(false); setNotifyResult(null); }}
              >
                {notifyResult ? 'Close' : 'Cancel'}
              </button>
              {!notifyResult && <button data-ui-button="primary"
                className={s.modalBtnPrimary}
                onClick={handleNotify}
                disabled={actionLoading || !notifyTitle.trim() || !notifyBody.trim()}
              >
                {actionLoading ? 'Sending…' : 'Send'}
              </button>}
            </div>
          </div>
        </Dialog>
      )}</>);
}
