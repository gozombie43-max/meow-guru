'use client';

import { useEffect, useRef, useState } from 'react';
import { Toast, ToastRegion } from '@/design-system/components/Toast';
import type { FeedbackTone } from '@/lib/feedback';

type FeedbackDetail = { message: string; tone?: FeedbackTone };

/** Global app-feedback listener backed by the canonical Meow Toast primitive. */
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

  const tone = feedback?.tone || 'success';

  return (
    <ToastRegion className="feedback-toast-region">
      {feedback ? (
        <Toast
          tone={tone}
          message={feedback.message}
          data-feedback-toast={tone}
        />
      ) : null}
    </ToastRegion>
  );
}
