import type { z } from 'zod';
import type { translationRequestSchema, translationResponseSchema } from '@meow/contracts/speech';
import { useState, useCallback, useRef } from "react";
import { requestResponse } from "@/shared/api/request";

type Lang = "en" | "hi" | "bn";

interface PendingBatch {
  keys: string[];
  controller: AbortController;
}

interface PendingEntry {
  promise: Promise<string>;
  waiters: number;
  batch?: PendingBatch;
}

type TranslationCache = Map<string, string>; // key: JSON([lang, text])
const sharedCache: TranslationCache = new Map();
const pending = new Map<string, PendingEntry>();
const cacheKey = (text: string, lang: Lang) => JSON.stringify([lang, text]);

function isAbortLikeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { name?: unknown; code?: unknown; kind?: unknown };
  return (
    candidate.name === 'AbortError'
    || candidate.name === 'CanceledError'
    || candidate.code === 'ERR_CANCELED'
    || candidate.kind === 'aborted'
  );
}

export function getCachedTranslation(text: string, lang: Lang) {
  return lang === "en" || !text.trim() || /^[A-Z\d]+$/.test(text.trim()) || /^[\d\s+×÷=,.:;()/'"−-]+$/.test(text)
    ? text
    : sharedCache.get(cacheKey(text, lang));
}

export function useTranslation() {
  const [activeLang, setActiveLang] = useState<Lang>("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const activeRequests = useRef(0);

  const translate = useCallback(async (
    texts: string[],
    targetLang: Lang,
    background = false,
    signal?: AbortSignal,
  ): Promise<string[]> => {
    if (targetLang === "en" || signal?.aborted) return texts;

    const results: string[] = new Array(texts.length);
    const toFetch: { idx: number; text: string; key: string }[] = [];
    const waiting: Promise<void>[] = [];
    const watchedKeys: string[] = [];
    const resolvePending = new Map<string, (value: string) => void>();
    const ownBatch: PendingBatch = { keys: [], controller: new AbortController() };

    // Check cache first
    texts.forEach((text, idx) => {
      const key = cacheKey(text, targetLang);
      const cached = getCachedTranslation(text, targetLang);
      if (cached !== undefined) {
        results[idx] = cached;
      } else {
        let entry = pending.get(key);
        if (!entry) {
          const promise = new Promise<string>((resolve) => resolvePending.set(key, resolve));
          entry = { promise, waiters: 0, batch: ownBatch };
          pending.set(key, entry);
          ownBatch.keys.push(key);
          toFetch.push({ idx, text, key });
        }
        entry.waiters += 1;
        watchedKeys.push(key);
        waiting.push(entry.promise.then((value) => { results[idx] = value; }));
      }
    });

    if (waiting.length === 0) return results;

    let released = false;
    let resolveAbortedWait: (() => void) | null = null;
    const abortedWait = signal
      ? new Promise<void>((resolve) => {
          resolveAbortedWait = resolve;
        })
      : null;

    const releaseWaiters = (aborted: boolean) => {
      if (released) return;
      released = true;
      const touchedBatches = new Set<PendingBatch>();
      for (const key of watchedKeys) {
        const entry = pending.get(key);
        if (!entry) continue;
        entry.waiters = Math.max(0, entry.waiters - 1);
        if (aborted && entry.batch) touchedBatches.add(entry.batch);
      }
      if (aborted) {
        for (const batch of touchedBatches) {
          if (batch.controller.signal.aborted) continue;
          // Only abort the shared HTTP batch when ZERO callers remain across ALL keys in that batch.
          const hasLiveWaiter = batch.keys.some((batchKey) => (pending.get(batchKey)?.waiters ?? 0) > 0);
          if (!hasLiveWaiter) batch.controller.abort();
        }
      }
    };

    const onAbort = () => {
      releaseWaiters(true);
      resolveAbortedWait?.();
    };
    signal?.addEventListener('abort', onAbort, { once: true });

    const awaitWaiting = async () => {
      if (signal?.aborted) return;
      if (abortedWait) {
        await Promise.race([Promise.all(waiting), abortedWait]);
      } else {
        await Promise.all(waiting);
      }
    };

    if (!background) {
      activeRequests.current += 1;
      setIsTranslating(true);
    }
    try {
      if (toFetch.length === 0) {
        await awaitWaiting();
        return texts.map((text, idx) => results[idx] ?? text);
      }
      // Let the shared transport restore a cookie-backed session on 401,
      // including after a reload when the in-memory token is still empty.
      const response = await requestResponse('/api/translate/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: toFetch.map(item => item.text), targetLang } satisfies z.input<typeof translationRequestSchema>),
        signal: ownBatch.controller.signal,
      }, { timeoutMs: 30_000 });

      if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
      const data: z.output<typeof translationResponseSchema> = await response.json();

      toFetch.forEach((item, i) => {
        const translated = data[i]?.translations?.[0]?.text ?? item.text;
        results[item.idx] = translated;
        if (typeof data[i]?.translations?.[0]?.text === "string") {
          sharedCache.set(item.key, translated);
          if (sharedCache.size > 2000) sharedCache.delete(sharedCache.keys().next().value!);
        }
      });
    } catch (err) {
      const isAbort = Boolean(ownBatch.controller.signal.aborted || signal?.aborted || isAbortLikeError(err));
      if (!isAbort) {
        console.error("Translation failed:", err);
      }
      toFetch.forEach((item) => {
        results[item.idx] = item.text; // fallback to original
      });
    } finally {
      signal?.removeEventListener('abort', onAbort);
      releaseWaiters(false);
      toFetch.forEach((item) => {
        resolvePending.get(item.key)?.(results[item.idx] ?? item.text);
        pending.delete(item.key);
      });
      await awaitWaiting();
      if (!background) {
        activeRequests.current -= 1;
        setIsTranslating(activeRequests.current > 0);
      }
    }

    return texts.map((text, idx) => results[idx] ?? text);
  }, []);

  return { activeLang, setActiveLang, translate, isTranslating };
}
