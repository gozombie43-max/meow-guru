"use client";
import { relativeTime, formatDate, canonicalRole, statusLabel } from './adminUsers.model';

import type { UserRole } from '@/types/admin';
import { X, Bell, Ban, Trash2, Shield, CheckCircle } from 'lucide-react';
import s from './AdminUsersPage.module.css';
import type { AdminUsersView } from './useAdminUsers';
export function AdminUserDetails({ view }: { view: AdminUsersView }) {
 const { selectedUser, userStats, drawerLoading, setShowNotifyModal, setShowDeleteConfirm, setShowStatusConfirm, actionLoading, setNotifyResult, closeDrawer, handleRoleChange } = view;
 return (<>{(selectedUser || drawerLoading) && (
        <>
          <div className={s.drawerOverlay} aria-hidden="true" />
          <div className={s.drawer}>
            <div data-ui-chrome="header" className={s.drawerHeader}>
              <div className={s.drawerTitle}>User Details</div>
              <button data-ui-button="icon" className={s.closeBtn} onClick={closeDrawer}>
                <X size={18} />
              </button>
            </div>

            {drawerLoading ? (
              <div className={s.loadingWrap}>
                <div className={s.spinner} />
              </div>
            ) : selectedUser ? (
              <div className={s.drawerBody}>
                {/* Profile header */}
                <div className={s.profileHeader}>
                  <div className={s.profileAvatar}>
                    {selectedUser.avatar ? (
                      <img src={selectedUser.avatar} alt={selectedUser.name} />
                    ) : (
                      '🐱'
                    )}
                  </div>
                  <div className={s.profileName}>{selectedUser.name}</div>
                  <div className={s.profileEmail}>{selectedUser.email}</div>
                </div>

                {/* Info section */}
                <div className={s.section}>
                  <div className={s.sectionTitle}>Account</div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Status</span>
                    <span className={`${s.statusDot} ${s[selectedUser.status || 'active']}`}>
                      {statusLabel(selectedUser.status || 'active')}
                    </span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Role</span>
                    <select
                      className={s.inlineSelect}
                      value={canonicalRole(selectedUser.role)}
                      onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                      disabled={actionLoading}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Auth Provider</span>
                    <span className={s.detailValue}>
                      {selectedUser.authProvider === 'google' ? '🔵 Google' : '📧 Email'}
                    </span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Joined</span>
                    <span className={s.detailValue}>{formatDate(selectedUser.createdAt)}</span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Last Login</span>
                    <span className={s.detailValue}>
                      {relativeTime(selectedUser.lastLoginAt || selectedUser.lastActiveDate)}
                    </span>
                  </div>
                </div>

                <div className={s.section}>
                  <div className={s.sectionTitle}>Notification capability</div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Platform</span>
                    <span className={`${s.detailValue} ${selectedUser.push?.androidRegistered ? s.pushEnabled : s.pushUnavailable}`}>
                      {selectedUser.push?.androidRegistered ? 'Android Push' : 'No Android Push'}
                    </span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Registered devices</span>
                    <span className={s.detailValue}>{selectedUser.push?.activeDeviceCount || 0}</span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Last device seen</span>
                    <span className={s.detailValue}>{relativeTime(selectedUser.push?.lastSeenAt || undefined)}</span>
                  </div>
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Notification route</span>
                    <span className={s.detailValue}>
                      {selectedUser.push?.androidRegistered ? 'In-app + Android push' : 'In-app only'}
                    </span>
                  </div>
                </div>

                {/* Learning stats */}
                {userStats && (
                  <div className={s.section}>
                    <div className={s.sectionTitle}>Learning</div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Questions attempted</span>
                      <span className={s.statRowValue}>
                        {userStats.questionsAttempted.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Correct answers</span>
                      <span className={s.statRowValue}>
                        {userStats.correctAnswers.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Accuracy</span>
                      <span className={s.statRowValue}>{userStats.accuracy}%</span>
                    </div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Mock tests</span>
                      <span className={s.statRowValue}>{userStats.mockTestsCompleted}</span>
                    </div>
                    <div className={s.statRow}>
                      <span className={s.statRowLabel}>Study time</span>
                      <span className={s.statRowValue}>
                        {userStats.studyTimeMinutes > 60
                          ? `${Math.round(userStats.studyTimeMinutes / 60)}h ${userStats.studyTimeMinutes % 60}m`
                          : `${userStats.studyTimeMinutes}m`}
                      </span>
                    </div>

                    {/* Top topics */}
                    {userStats.topTopics.length > 0 && (
                      <>
                        <div
                          className={s.sectionTitle}
                          style={{ marginTop: 16 }}
                        >
                          Top Topics
                        </div>
                        {userStats.topTopics.slice(0, 5).map((t) => (
                          <div className={s.statRow} key={t.topic}>
                            <span className={s.statRowLabel}>{t.topic}</span>
                            <span className={s.statRowValue}>
                              {t.accuracy}% ({t.attempted})
                            </span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Exam preferences */}
                {selectedUser.examPreferences && selectedUser.examPreferences.length > 0 && (
                  <div className={s.section}>
                    <div className={s.sectionTitle}>Exam Focus</div>
                    <div className={s.examTags}>
                      {selectedUser.examPreferences.map((exam) => (
                        <span key={exam} className={s.examTag}>
                          {exam.replace(/-/g, ' ').toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Account actions */}
                <div className={s.section}>
                  <div className={s.sectionTitle}>Actions</div>
                  <div className={s.actions}>
                    <button data-ui-button="secondary"
                      className={s.actionBtn}
                      onClick={() => { setNotifyResult(null); setShowNotifyModal(true); }}
                    >
                      <Bell size={16} />
                      Send Notification
                    </button>

                    {(selectedUser.status || 'active') === 'active' ? (
                      <button data-ui-button="state"
                        className={`${s.actionBtn} ${s.danger}`}
                        onClick={() => setShowStatusConfirm('suspended')}
                        disabled={actionLoading}
                      >
                        <Ban size={16} />
                        Suspend Account
                      </button>
                    ) : (
                      <button data-ui-button="secondary"
                        className={s.actionBtn}
                        onClick={() => setShowStatusConfirm('active')}
                        disabled={actionLoading}
                      >
                        <CheckCircle size={16} />
                        Reactivate Account
                      </button>
                    )}

                    {(selectedUser.status || 'active') !== 'banned' && (
                      <button data-ui-button="state"
                        className={`${s.actionBtn} ${s.danger}`}
                        onClick={() => setShowStatusConfirm('banned')}
                        disabled={actionLoading}
                      >
                        <Shield size={16} />
                        Ban Account
                      </button>
                    )}

                    <button data-ui-button="state"
                      className={`${s.actionBtn} ${s.danger}`}
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={actionLoading}
                    >
                      <Trash2 size={16} />
                      Delete User
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}</>);
}
