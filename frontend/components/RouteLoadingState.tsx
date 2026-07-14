import { LoaderCircle } from 'lucide-react';

interface RouteLoadingStateProps {
  label: string;
}

export default function RouteLoadingState({ label }: RouteLoadingStateProps) {
  return (
    <main className="route-boundary" aria-busy="true" aria-live="polite">
      <div className="route-boundary__content">
        <LoaderCircle className="route-boundary__spinner" aria-hidden="true" />
        <p>Loading {label}...</p>
      </div>
    </main>
  );
}