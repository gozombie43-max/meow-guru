import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { planQuestionTranslation } from '@/lib/question-translation';
import type { MockQuestion } from './api';

export function useMockTranslation(question: MockQuestion | undefined, context: string, language: string | null) {
  const lang = language === 'hi' || language === 'bn' ? language : 'en';
  const { translate } = useTranslation();
  const supplied = question?.translations;

  // Only short-circuit on supplied translations when the requested language is natively present
  // (en or bn). Hindi (hi) falls back to `/api/translate/` unless natively provided.
  const hasNativeSupplied = Boolean(
    supplied && (
      lang === 'en'
      || (lang === 'bn' && (
        Boolean(supplied.question?.bn?.trim())
        || (Array.isArray(supplied.options?.bn) && supplied.options.bn.some(opt => Boolean(opt?.trim())))
      ))
    ),
  );

  const plan = useMemo(() => planQuestionTranslation({
    question: question?.text ?? question?.question ?? '',
    options: question?.options?.map(option => typeof option === 'string' ? option : option.text),
  }, context), [question, context]);
  const key = useMemo(() => JSON.stringify([lang, context, plan.source]), [lang, context, plan.source]);
  const [result, setResult] = useState<{ key: string; texts: string[] } | null>(null);

  useEffect(() => {
    if (hasNativeSupplied || lang === 'en' || !question) return;
    const controller = new AbortController();
    let cancelled = false;
    void translate(plan.texts, lang, false, controller.signal).then(texts => {
      if (!cancelled && !controller.signal.aborted) setResult({ key, texts: plan.restore(texts) });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, lang, plan, question, translate, hasNativeSupplied]);

  if (supplied && hasNativeSupplied) {
    const nativeLanguage = lang === 'bn' ? 'bn' : 'en';
    const qText = supplied.question?.[nativeLanguage]?.trim()
      || supplied.question?.en?.trim()
      || plan.source[0]
      || '';
    const localizedOpts = Array.isArray(supplied.options?.[nativeLanguage]) ? supplied.options[nativeLanguage] : [];
    const fallbackOpts = Array.isArray(supplied.options?.en) ? supplied.options.en : plan.source.slice(1);
    const optCount = Math.max(localizedOpts.length, fallbackOpts.length);
    const options = Array.from({ length: optCount }, (_, i) => localizedOpts[i]?.trim() || fallbackOpts[i] || '');
    return { texts: [qText, ...options], pending: false };
  }

  return {
    texts: lang !== 'en' && result?.key === key ? result.texts : plan.source,
    pending: lang !== 'en' && !!question && result?.key !== key,
  };
}
