"use client";
import { relativeTime, formatDate, formatNumber, canonicalRole, roleLabel, statusLabel } from './adminUsers.model';

import type { UserRole, UserStatus } from '@/types/admin';
import { Search, ChevronLeft, ChevronRight, Users, UserCheck, UserPlus, ShieldAlert, MoreVertical, AlertCircle, Smartphone } from 'lucide-react';
import s from './AdminUsersPage.module.css';
import type { AdminUsersView } from './useAdminUsers';
export function AdminUsersTable({ view }: { view: AdminUsersView }) {
 const { stats, data, loading, error, search, setSearch, statusFilter, setStatusFilter, roleFilter, setRoleFilter, pushFilter, setPushFilter, sort, setSort, page, setPage, debouncedSearch, openDrawer, totalPages, showingStart, showingEnd, getPageNumbers } = view;
 return (<div className={s.content}>
        {/* ── Error Banner ───────────────────────────────── */}
        {error && (
          <div className={s.errorBanner}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* ── Stats Cards ───────────────────────────────── */}
        <div className={s.statsGrid}>
          <div className={s.statCard}>
            <div className={`${s.statIcon} ${s.blue}`}>
              <Users size={16} />
            </div>
            <div className={s.statValue}>{stats ? formatNumber(stats.totalUsers) : '—'}</div>
            <div className={s.statLabel}>Total Users</div>
          </div>
          <div className={s.statCard}>
            <div className={`${s.statIcon} ${s.green}`}>
              <UserCheck size={16} />
            </div>
            <div className={s.statValue}>{stats ? formatNumber(stats.activeToday) : '—'}</div>
            <div className={s.statLabel}>Active Today</div>
          </div>
          <div className={s.statCard}>
            <div className={`${s.statIcon} ${s.purple}`}>
              <UserPlus size={16} />
            </div>
            <div className={s.statValue}>{stats ? formatNumber(stats.newThisWeek) : '—'}</div>
            <div className={s.statLabel}>New This Week</div>
          </div>
          <div className={s.statCard}>
            <div className={`${s.statIcon} ${s.red}`}>
              <ShieldAlert size={16} />
            </div>
            <div className={s.statValue}>{stats ? formatNumber(stats.suspendedCount) : '—'}</div>
            <div className={s.statLabel}>Suspended</div>
          </div>
        </div>

        {/* ── Toolbar ────────────────────────────────────── */}
        <div className={s.toolbar}>
          <div className={s.searchWrap}>
            <Search size={16} className={s.searchIcon} />
            <input
              className={s.searchInput}
              type="search" spellCheck={false} autoCapitalize="none" autoCorrect="off" autoComplete="off"
              placeholder="Search users by name, email or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
             aria-label="Search users by name, email or ID..."/>
          </div>
          <select
            className={s.filterSelect}
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value as UserRole | '');
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            <option value="user">User</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <select
            className={s.filterSelect}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as UserStatus | '');
              setPage(1);
            }}
          >
              <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>
          <select
            className={s.filterSelect}
            value={pushFilter}
            onChange={(e) => {
              setPushFilter(e.target.value as 'android' | 'none' | '');
              setPage(1);
            }}
          >
            <option value="">All Push States</option>
            <option value="android">Android Push</option>
            <option value="none">No Android Push</option>
          </select>
          <select
            className={s.filterSelect}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="-createdAt">Newest First</option>
            <option value="createdAt">Oldest First</option>
            <option value="name">Name A–Z</option>
            <option value="-name">Name Z–A</option>
            <option value="-lastLoginAt">Last Active</option>
          </select>
        </div>

        {/* ── User Table ─────────────────────────────────── */}
        <div className={s.tableCard}>
          {/* Desktop header */}
          <div className={s.tableHeader}>
            <span>User</span>
            <span>Role</span>
            <span>Platform / Push</span>
            <span>Status</span>
            <span>Joined</span>
            <span>Last Active</span>
            <span />
          </div>

          {loading ? (
            <div className={s.loadingWrap}>
              <div className={s.spinner} />
            </div>
          ) : !data || data.users.length === 0 ? (
            <div className={s.emptyState}>
              {debouncedSearch || statusFilter || roleFilter
                ? 'No users match your filters'
                : 'No users found'}
            </div>
          ) : (
            <>
              {data.users.map((u) => (
                <div
                  key={u.id}
                  className={s.tableRow}
                  onClick={() => openDrawer(u.id)}
                 role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                  <div className={s.userCell}>
                    <div className={s.avatar}>
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} />
                      ) : (
                        '🐱'
                      )}
                    </div>
                    <div className={s.userInfo}>
                      <div className={s.userName}>{u.name}</div>
                      <div className={s.userEmail}>{u.email}</div>
                    </div>
                  </div>
                  <div className={s.rowMetadata}>
                  <div>
                    <span className={`${s.roleBadge} ${s[canonicalRole(u.role)]}`}>
                      {roleLabel(u.role)}
                    </span>
                  </div>
                  <div className={s.pushCell}>
                    <Smartphone size={15} aria-hidden="true" />
                    <span className={u.push?.androidRegistered ? s.pushEnabled : s.pushUnavailable}>
                      {u.push?.androidRegistered
                        ? `Android Push · ${u.push.activeDeviceCount} device${u.push.activeDeviceCount === 1 ? '' : 's'}`
                        : 'No Android Push'}
                    </span>
                  </div>
                  <div>
                    <span className={`${s.statusDot} ${s[u.status || 'active']}`}>
                      {statusLabel(u.status || 'active')}
                    </span>
                  </div>
                  </div>
                  <div className={s.rowDates}>
                  <div className={s.dateCell}>
                    <span className={s.mobileDateLabel}>Joined </span>
                    {formatDate(u.createdAt)}
                  </div>
                  <div className={s.dateCell}>
                    <span className={s.mobileDateLabel}>Active </span>
                    {relativeTime(u.lastLoginAt || u.lastActiveDate)}
                  </div>
                  </div>
                  <div className={s.rowActions}>
                    <button data-ui-button="icon"
                      className={s.moreBtn}
                      aria-label={`View details for ${u.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDrawer(u.id);
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {/* ── Pagination ───────────────────────────── */}
              <div className={s.pagination}>
                <div className={s.pageInfo}>
                  Showing {showingStart}–{showingEnd} of{' '}
                  {data.total.toLocaleString('en-IN')}
                </div>
                <div className={s.pageButtons}>
                  <button data-ui-button="state" data-ui-shape="icon"
                    className={s.pageBtn}
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {getPageNumbers().map((p, i) =>
                    p === '...' ? (
                      <span key={`dots-${i}`} className={s.pageBtn} style={{ cursor: 'default', border: 'none' }}>
                        …
                      </span>
                    ) : (
                      <button data-ui-button="state"
                        key={p}
                        className={`${s.pageBtn} ${p === page ? s.active : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button data-ui-button="state" data-ui-shape="icon"
                    className={s.pageBtn}
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>);
}
