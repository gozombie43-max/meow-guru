'use client';
import { SWRConfig } from 'swr';
import { API_BASE } from '@/lib/api-base';
import type { PublicTopicCounts } from '@/lib/server/publicCatalog';
import type { ReactNode } from 'react';

export function CatalogSeed({ snapshot, children }: { snapshot: PublicTopicCounts | null; children: ReactNode }) {
  if (!snapshot) return children;
  const key = `${API_BASE}/api/progress/topics?subject=${encodeURIComponent(snapshot.subject)}`;
  return <SWRConfig value={{ fallback: { [key]: snapshot } }}>{children}</SWRConfig>;
}
