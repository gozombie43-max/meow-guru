import { useState, useCallback, useRef } from "react";

type Lang = "en" | "hi" | "bn";

type TranslationCache = Map<string, string>; // key: `${text}:${lang}`

export function useTranslation() {
  const [activeLang, setActiveLang] = useState<Lang>("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const cacheRef = useRef<TranslationCache>(new Map());

  const translate = useCallback(async (texts: string[], targetLang: Lang): Promise<string[]> => {
    if (targetLang === "en") return texts;

    const results: string[] = new Array(texts.length);
    const toFetch: { idx: number; text: string }[] = [];

    // Check cache first
    texts.forEach((text, idx) => {
      const key = `${text}:${targetLang}`;
      const cached = cacheRef.current.get(key);
      if (cached) {
        results[idx] = cached;
      } else {
        toFetch.push({ idx, text });
      }
    });

    if (toFetch.length === 0) return results;

    setIsTranslating(true);
    try {
      const response = await fetch(`/api/translate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: toFetch.map((item) => item.text), targetLang }),
      });

      const data = await response.json();

      toFetch.forEach((item, i) => {
        const translated = data[i]?.translations?.[0]?.text ?? item.text;
        results[item.idx] = translated;
        cacheRef.current.set(`${item.text}:${targetLang}`, translated);
      });
    } catch (err) {
      console.error("Translation failed:", err);
      toFetch.forEach((item) => {
        results[item.idx] = item.text; // fallback to original
      });
    } finally {
      setIsTranslating(false);
    }

    return results;
  }, []);

  return { activeLang, setActiveLang, translate, isTranslating };
}
