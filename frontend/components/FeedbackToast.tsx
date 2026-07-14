'use client';

import { useEffect, useRef, useState } from 'react';
import type { FeedbackTone } from '@/lib/feedback';

type FeedbackDetail = { message: string; tone?: FeedbackTone };

export default function FeedbackToast() {
  const [feedback, setFeedback] = useState<FeedbackDetail | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleFeedback = (event: Event) => {
      const detail = (event as CustomEvent<FeedbackDetail>).detail;
      if (!detail?.message) return;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      setFeedback(detail);
      timeoutRef.current = window.setTimeout(() => setFeedback(null), 3200);
    };

    window.addEventListener('app-feedback', handleFeedback);
    return () => {
      window.removeEventListener('app-feedback', handleFeedback);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="feedback-toast-region" aria-live="polite" aria-atomic="true">
      {feedback ? <div className={`feedback-toast feedback-toast--${feedback.tone || 'success'}`} role="status">{feedback.message}</div> : null}
    </div>
  );
}