import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { planQuestionTranslation } from '@/lib/question-translation';
import type { MockQuestion } from './api';

export function useMockTranslation(question: MockQuestion | undefined, context: string, language: string | null) {
  const lang = language === 'hi' || language === 'bn' ? language : 'en';
  const { translate } = useTranslation();
  const supplied = question?.translations;
  const plan = useMemo(() => planQuestionTranslation({
    question: question?.text ?? question?.question ?? '',
    options: question?.options?.map(option => typeof option === 'string' ? option : option.text),
  }, context), [question, context]);
  const key = JSON.stringify([lang, context, plan.source]);
  const [result, setResult] = useState<{ key: string; texts: string[] } | null>(null);

  useEffect(() => {
    if (supplied || lang === 'en' || !question) return;
    let cancelled = false;
    void translate(plan.texts, lang).then(texts => {
      if (!cancelled) setResult({ key, texts: plan.restore(texts) });
    });
    return () => { cancelled = true; };
  }, [key, lang, plan, question, translate, supplied]);

  if (supplied) {
    const nativeLanguage = lang === 'bn' ? 'bn' : 'en';
    return { texts: [supplied.question[nativeLanguage], ...supplied.options[nativeLanguage]], pending: false };
  }

  return {
    texts: lang !== 'en' && result?.key === key ? result.texts : plan.source,
    pending: lang !== 'en' && !!question && result?.key !== key,
  };
}
