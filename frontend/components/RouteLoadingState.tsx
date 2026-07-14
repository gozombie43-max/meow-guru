"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, RefreshCw } from "lucide-react";

interface RouteLoadingStateProps {
  label: string;
}

export default function RouteLoadingState({ label }: RouteLoadingStateProps) {
  const router = useRouter();
  const [showRecovery, setShowRecovery] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const recoveryTimer = window.setTimeout(() => setShowRecovery(true), 12_000);
    return () => window.clearTimeout(recoveryTimer);
  }, []);

  const retry = () => {
    setIsRetrying(true);
    router.refresh();
  };

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
      {showRecovery && (
        <section className="route-boundary__recovery" aria-live="polite">
          <h1>This is taking longer than expected</h1>
          <p>Refresh this page section or return home and try again.</p>
          <div className="route-boundary__actions">
            <button className="route-boundary__retry" type="button" onClick={retry} disabled={isRetrying}>
              <RefreshCw size={16} aria-hidden="true" className={isRetrying ? "route-boundary__spin" : undefined} />
              {isRetrying ? "Retrying" : "Try again"}
            </button>
            <Link className="route-boundary__home" href="/">
              <Home size={16} aria-hidden="true" />
              Home
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}