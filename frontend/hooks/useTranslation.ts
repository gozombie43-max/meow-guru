import { useState, useCallback, useRef } from "react";
import { requestResponse } from "@/shared/api/request";

type Lang = "en" | "hi" | "bn";

type TranslationCache = Map<string, string>; // key: `${text}:${lang}`
const sharedCache: TranslationCache = new Map();
const pending = new Map<string, Promise<string>>();
const cacheKey = (text: string, lang: Lang) => JSON.stringify([lang, text]);

export function getCachedTranslation(text: string, lang: Lang) {
  return lang === "en" || !text.trim() || /^[A-Z\d]+$/.test(text.trim()) || /^[\d\s+×÷=,.:;()/'"−-]+$/.test(text)
    ? text
    : sharedCache.get(cacheKey(text, lang));
}

export function useTranslation() {
  const [activeLang, setActiveLang] = useState<Lang>("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const activeRequests = useRef(0);

  const translate = useCallback(async (texts: string[], targetLang: Lang, background = false): Promise<string[]> => {
    if (targetLang === "en") return texts;

    const results: string[] = new Array(texts.length);
    const toFetch: { idx: number; text: string }[] = [];
    const waiting: Promise<void>[] = [];
    const resolvePending = new Map<string, (value: string) => void>();

    // Check cache first
    texts.forEach((text, idx) => {
      const key = cacheKey(text, targetLang);
      const cached = getCachedTranslation(text, targetLang);
      if (cached !== undefined) {
        results[idx] = cached;
      } else {
        let promise = pending.get(key);
        if (!promise) {
          promise = new Promise<string>((resolve) => resolvePending.set(key, resolve));
          pending.set(key, promise);
          toFetch.push({ idx, text });
        }
        waiting.push(promise.then((value) => { results[idx] = value; }));
      }
    });

    if (waiting.length === 0) return results;

    if (!background) {
      activeRequests.current += 1;
      setIsTranslating(true);
    }
    try {
      if (toFetch.length === 0) {
        await Promise.all(waiting);
        return results;
      }
      // Let the shared transport restore a cookie-backed session on 401,
      // including after a reload when the in-memory token is still empty.
      const response = await requestResponse('/api/translate/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: toFetch.map(item => item.text), targetLang }),
      }, { timeoutMs: 30_000 });

      if (!response.ok) throw new Error(`Translation failed: ${response.status}`);
      const data = await response.json();

      toFetch.forEach((item, i) => {
        const translated = data[i]?.translations?.[0]?.text ?? item.text;
        results[item.idx] = translated;
        if (typeof data[i]?.translations?.[0]?.text === "string") {
          sharedCache.set(cacheKey(item.text, targetLang), translated);
          if (sharedCache.size > 2000) sharedCache.delete(sharedCache.keys().next().value!);
        }
      });
    } catch (err) {
      console.error("Translation failed:", err);
      toFetch.forEach((item) => {
        results[item.idx] = item.text; // fallback to original
      });
    } finally {
      toFetch.forEach((item) => {
        const key = cacheKey(item.text, targetLang);
        resolvePending.get(key)?.(results[item.idx] ?? item.text);
        pending.delete(key);
      });
      await Promise.all(waiting);
      if (!background) {
        activeRequests.current -= 1;
        setIsTranslating(activeRequests.current > 0);
      }
    }

    return results;
  }, []);

  return { activeLang, setActiveLang, translate, isTranslating };
}
