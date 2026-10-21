/** Explicit DOM scrolling must respect the same preference as CSS motion. */
export function preferredScrollBehavior(): ScrollBehavior {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 'instant' : 'smooth';
}
