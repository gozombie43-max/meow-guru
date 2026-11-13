export type PrimaryNavItemId = 'home' | 'mock' | 'assistant' | 'play' | 'profile';

export interface PrimaryNavItem {
  id: PrimaryNavItemId;
  href: string;
  label: string;
  ariaLabel?: string;
  match: 'exact' | 'prefix';
}

export const PRIMARY_NAV_ITEMS: readonly PrimaryNavItem[] = [
  { id: 'home', href: '/', label: 'Home', match: 'exact' },
  { id: 'mock', href: '/mock-test', label: 'Mock', match: 'prefix' },
  { id: 'assistant', href: '/ai-chat', label: 'Assistant', ariaLabel: 'AI Assistant', match: 'prefix' },
  { id: 'play', href: '/play', label: 'Play', match: 'prefix' },
  { id: 'profile', href: '/profile', label: 'You', match: 'prefix' },
] as const;

export function isPrimaryNavItemActive(
  pathname: string,
  item: Pick<PrimaryNavItem, 'href' | 'match'>,
): boolean {
  const normalized = (pathname || '/').replace(/\/+$/, '') || '/';
  const href = item.href.replace(/\/+$/, '') || '/';
  if (item.match === 'exact') {
    return normalized === href;
  }
  return normalized === href || normalized.startsWith(`${href}/`);
}
