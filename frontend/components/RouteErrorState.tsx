'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

interface RouteErrorStateProps {
  label: string;
  reset: () => void;
}

export default function RouteErrorState({ label, reset }: RouteErrorStateProps) {
  return (
    <main className="route-boundary" role="alert">
      <div className="route-boundary__content route-boundary__content--error">
        <AlertCircle aria-hidden="true" />
        <div>
          <h1>Unable to load {label}</h1>
          <p>Check your connection and try again.</p>
        </div>
        <button className="route-boundary__retry" type="button" onClick={reset}>
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
      </div>
    </main>
  );
}