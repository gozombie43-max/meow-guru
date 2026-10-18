'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { subscribeMockCatalog } from '@/lib/mock-catalog-revision';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { fetchCatalog, readCatalog } from './catalog-cache';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
const options = { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false };

export function useExamCatalog(exam: string, tab: string, tier: string, loadingOnly: boolean, year?: string) {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const base = `/api/mocktest/${encodeURIComponent(exam)}/slots?catalog=1`;
  const metadataKey = `${base}&limit=0`;
  const metadataRequest = useSWR(hydrated ? metadataKey : null, loadingOnly ? null : fetchCatalog, {
    ...options, fallbackData: hydrated ? readCatalog(metadataKey)?.data : undefined,
  });
  const metadata = metadataRequest.data?.metadata;
  const effectiveTier = metadata?.tiers.includes(tier) ? tier : metadata?.tiers[0] || '';
  const latestYear = metadata?.years?.length ? String(Math.max(...metadata.years)) : '';
  const effectiveYear = year === undefined ? latestYear : year;
  const firstKey = `${base}&kind=${tab === 'prev' ? 'pyq' : 'mock'}&tier=${encodeURIComponent(effectiveTier)}${tab === 'prev' && effectiveYear ? `&year=${encodeURIComponent(effectiveYear)}` : ''}&limit=20&offset=0`;
  const pages = useSWRInfinite((index, previous) => {
    if (!hydrated || loadingOnly || !metadata || tab === 'overview' || (previous && previous.nextOffset === null)) return null;
    return index === 0 ? firstKey : firstKey.replace(/offset=0$/, `offset=${previous.nextOffset}`);
  }, fetchCatalog, { ...options, revalidateFirstPage: true, persistSize: false });
  const refreshMetadata = metadataRequest.mutate;
  const refreshPages = pages.mutate;
  useEffect(() => {
    if (loadingOnly) return;
    return subscribeMockCatalog(exam, () => {
      void refreshMetadata();
      void refreshPages();
    });
  }, [exam, loadingOnly, refreshMetadata, refreshPages]);
  const data = pages.data || (hydrated && metadata && readCatalog(firstKey) ? [readCatalog(firstKey)!.data] : undefined);
  const slots = Array.from(new Map((data || []).flatMap(page => page.slots).map(slot => [slot.id, slot])).values());
  const error = metadataRequest.error || pages.error;
  return {
    metadata, effectiveTier, effectiveYear, slots,
    loading: !data && !error,
    error,
    hasMore: data?.at(-1)?.nextOffset != null,
    loadingMore: pages.isValidating,
    loadMore: () => { if (!pages.isValidating) void pages.setSize(pages.size + 1); },
    retry: () => { void metadataRequest.mutate(); void pages.mutate(); },
  };
}
