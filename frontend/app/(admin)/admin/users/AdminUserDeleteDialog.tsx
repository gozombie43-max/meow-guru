"use client";

import { Dialog } from "@/components/ui/Dialog";

import s from './AdminUsersPage.module.css';
import type { AdminUsersView } from './useAdminUsers';
export function AdminUserDeleteDialog({ view }: { view: AdminUsersView }) {
 const { selectedUser, showDeleteConfirm, setShowDeleteConfirm, actionLoading, handleDelete } = view;
 return (<>{showDeleteConfirm && selectedUser && (
        <Dialog onClose={() => setShowDeleteConfirm(false)} busy={actionLoading} initialFocus="button" className={s.modal} role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title">
          <div className={s.modalCard}>
            <div id="delete-user-title" className={s.modalTitle}>
              Delete {selectedUser.name}?
            </div>
            <p style={{ fontSize: 14, color: '#636366', marginBottom: 16 }}>
              This will permanently remove the user account and all associated data.
              This action cannot be undone.
            </p>
            <div className={s.modalActions}>
              <button data-ui-button="secondary"
                className={s.modalBtnSecondary}
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button data-ui-button="danger"
                className={s.modalBtnDanger}
                onClick={handleDelete}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </Dialog>
      )}</>);
}
