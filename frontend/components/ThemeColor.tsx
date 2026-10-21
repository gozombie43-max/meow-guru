'use client';

import { useThemeMode } from '@/hooks/useTheme';

/** React owns this metadata so hydration and navigation cannot duplicate it. */
export default function ThemeColor() {
  const { theme } = useThemeMode();
  return <meta name="theme-color" content={theme === 'dark' ? '#000000' : '#f4f5f7'} />;
}
