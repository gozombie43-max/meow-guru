export type FeedbackTone = 'success' | 'error' | 'info';

export function announceFeedback(message: string, tone: FeedbackTone = 'success') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app-feedback', { detail: { message, tone } }));
}