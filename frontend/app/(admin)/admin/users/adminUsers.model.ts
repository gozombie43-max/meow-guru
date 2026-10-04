

import type { UserRole } from '@/types/admin';

export function relativeTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return '—';
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}
export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
export function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return n.toLocaleString('en-IN');
  return String(n);
}
export function canonicalRole(role: string): UserRole {
  return (role === 'student' ? 'user' : role) as UserRole;
}
export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    user: 'User',
    student: 'User',
    moderator: 'Mod',
    admin: 'Admin',
    superadmin: 'Super',
  };
  return labels[role] || role;
}
export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    suspended: 'Suspended',
    banned: 'Banned',
  };
  return labels[status] || status;
}
