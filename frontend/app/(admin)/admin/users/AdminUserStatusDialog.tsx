"use client";

import { Dialog } from "@/components/ui/Dialog";

import s from './AdminUsersPage.module.css';
import type { AdminUsersView } from './useAdminUsers';
export function AdminUserStatusDialog({ view }: { view: AdminUsersView }) {
 const { selectedUser, showStatusConfirm, setShowStatusConfirm, actionLoading, statusReason, setStatusReason, handleStatusChange } = view;
 return (<>{showStatusConfirm && selectedUser && (
        <Dialog onClose={() => setShowStatusConfirm(null)} busy={actionLoading} className={s.modal} role="dialog" aria-modal="true" aria-labelledby="status-user-title">
          <div className={s.modalCard}>
            <div id="status-user-title" className={s.modalTitle}>
              {showStatusConfirm === 'active'
                ? `Reactivate ${selectedUser.name}?`
                : showStatusConfirm === 'banned'
                  ? `Ban ${selectedUser.name}?`
                  : `Suspend ${selectedUser.name}?`}
            </div>
            {showStatusConfirm !== 'active' && (
              <input
                className={s.modalInput}
                placeholder="Reason (optional)"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
               aria-label="Reason (optional)"/>
            )}
            <div className={s.modalActions}>
              <button data-ui-button="secondary"
                className={s.modalBtnSecondary}
                onClick={() => setShowStatusConfirm(null)}
              >
                Cancel
              </button>
              <button data-ui-button="state"
                className={
                  showStatusConfirm === 'active'
                    ? s.modalBtnPrimary
                    : s.modalBtnDanger
                }
                onClick={() => handleStatusChange(showStatusConfirm)}
                disabled={actionLoading}
              >
                {actionLoading
                  ? 'Processing…'
                  : showStatusConfirm === 'active'
                    ? 'Reactivate'
                    : showStatusConfirm === 'banned'
                      ? 'Ban User'
                      : 'Suspend'}
              </button>
            </div>
          </div>
        </Dialog>
      )}</>);
}
