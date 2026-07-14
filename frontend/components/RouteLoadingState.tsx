interface RouteLoadingStateProps {
  label: string;
}

export default function RouteLoadingState({ label }: RouteLoadingStateProps) {
  return (
    <main className="route-boundary" aria-busy="true" aria-label={`Loading ${label}`}>
      <p className="sr-only" role="status" aria-live="polite">Loading {label}</p>
      <div className="route-boundary__skeleton" aria-hidden="true">
        <div className="route-boundary__skeleton-header">
          <span className="route-boundary__skeleton-line route-boundary__skeleton-line--short" />
          <span className="route-boundary__skeleton-line route-boundary__skeleton-line--medium" />
        </div>
        <div className="route-boundary__skeleton-tabs">
          <span />
          <span />
          <span />
        </div>
        <div className="route-boundary__skeleton-cards">
          <div />
          <div />
          <div />
        </div>
      </div>
    </main>
  );
}