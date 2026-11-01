export function formatLastSeen(lastDisconnected: number, now: number): string {
  if (!Number.isFinite(lastDisconnected) || lastDisconnected <= 0) {
    return 'Last seen recently';
  }

  const elapsed = Math.max(0, now - lastDisconnected);

  if (elapsed < 60_000) {
    return 'Last seen just now';
  }

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) {
    return `Last seen ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  const hours = Math.floor(elapsed / 3_600_000);
  if (hours < 24) {
    return `Last seen ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  const days = Math.floor(elapsed / 86_400_000);
  if (days < 7) {
    return `Last seen ${days} ${days === 1 ? 'day' : 'days'} ago`;
  }

  return `Last seen ${new Date(lastDisconnected).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })}`;
}

export function formatOnlineCount(count: number, capped: boolean): string {
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return `${new Intl.NumberFormat('en-IN').format(safeCount)}${capped ? '+' : ''}`;
}
