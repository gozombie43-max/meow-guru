"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const NAVIGATION_TIMEOUT_MS = 12_000;

function getInternalDestination(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;

  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link || link.target || link.hasAttribute("download")) return null;

  const destination = new URL(link.href, window.location.href);
  if (destination.origin !== window.location.origin) return null;

  return `${destination.pathname}${destination.search}`;
}

function isInternalNavigation(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }

  const current = new URL(window.location.href);
  const destination = getInternalDestination(event.target);
  return destination !== null && destination !== `${current.pathname}${current.search}`;
}

export default function PageTransitionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const stopTransition = () => {
      setIsNavigating(false);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    stopTransition();
    return stopTransition;
  }, [pathname]);

  useEffect(() => {
    const startTransition = (event: MouseEvent) => {
      if (!isInternalNavigation(event)) return;

      setIsNavigating(true);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
        setIsNavigating(false);
        timeoutRef.current = null;
      }, NAVIGATION_TIMEOUT_MS);
    };

    document.addEventListener("click", startTransition, true);
    return () => document.removeEventListener("click", startTransition, true);
  }, []);

  useEffect(() => {
    const prefetchDestination = (event: Event) => {
      const destination = getInternalDestination(event.target);
      if (destination) router.prefetch(destination);
    };

    document.addEventListener("pointerover", prefetchDestination, true);
    document.addEventListener("pointerdown", prefetchDestination, true);
    document.addEventListener("focusin", prefetchDestination, true);

    return () => {
      document.removeEventListener("pointerover", prefetchDestination, true);
      document.removeEventListener("pointerdown", prefetchDestination, true);
      document.removeEventListener("focusin", prefetchDestination, true);
    };
  }, [router]);

  return (
    <div className="page-transition-shell">
      <div key={pathname} className="page-transition-shell__page">
        {children}
      </div>
      <div
        className={`page-transition-shell__progress${isNavigating ? " is-active" : ""}`}
        aria-hidden="true"
      />
    </div>
  );
}