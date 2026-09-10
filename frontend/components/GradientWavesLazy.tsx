"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import RiskyWidgetBoundary from "./RiskyWidgetBoundary";

const GradientWaves = dynamic(() => import("./GradientWaves"), { ssr: false });

type GradientWavesProps = React.ComponentProps<typeof GradientWaves>;

export default function GradientWavesLazy(props: GradientWavesProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    const motionMql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mediaTimer = window.setTimeout(() => {
      setIsMobile(mql.matches);
      setPrefersReducedMotion(motionMql.matches);
    }, 0);

    if (mql.matches || motionMql.matches) {
      return () => window.clearTimeout(mediaTimer);
    }

    // Defer WebGL init until after critical UI paints
    const schedule = typeof requestIdleCallback === "function" ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 200);
    const cancel = typeof cancelIdleCallback === "function" ? cancelIdleCallback : clearTimeout;
    const handle = schedule(() => setShouldRender(true));
    return () => {
      window.clearTimeout(mediaTimer);
      cancel(handle as number);
    };
  }, []);

  if (prefersReducedMotion || isMobile) {
    return <div className="gradient-waves-fallback" />;
  }

  if (!shouldRender) return null;

  return (
    <RiskyWidgetBoundary label="animated background">
      <GradientWaves {...props} />
    </RiskyWidgetBoundary>
  );
}
