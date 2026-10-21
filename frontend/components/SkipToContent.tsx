'use client';

/** Keep the anchor usable before hydration and focus the route's content after it. */
export default function SkipToContent() {
  return (
    <a className="skip-to-content" href="#main-content" onClick={event => {
      const container = document.getElementById('main-content');
      const content = container?.querySelector<HTMLElement>('[data-page-content]')
        ?? container?.querySelector<HTMLElement>('main, [role="main"]') ?? container;
      if (!content) return;
      event.preventDefault();
      if (!content.hasAttribute('tabindex')) content.tabIndex = -1;
      content.focus({ preventScroll: true });
      content.scrollIntoView({ block: 'start', behavior: 'instant' });
    }}>
      Skip to content
    </a>
  );
}
