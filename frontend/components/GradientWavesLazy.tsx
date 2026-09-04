"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const GradientWaves = dynamic(() => import("./GradientWaves"), { ssr: false });

type GradientWavesProps = React.ComponentProps<typeof GradientWaves>;

export default function GradientWavesLazy(props: GradientWavesProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 768px)");
    setIsMobile(mql.matches);
    const motionMql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionMql.matches);

    if (mql.matches || motionMql.matches) return;

    // Defer WebGL init until after critical UI paints
    const schedule = typeof requestIdleCallback === "function" ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 200);
    const cancel = typeof cancelIdleCallback === "function" ? cancelIdleCallback : clearTimeout;
    const handle = schedule(() => setShouldRender(true));
    return () => cancel(handle as number);
  }, []);

  if (prefersReducedMotion || isMobile) {
    return <div className="gradient-waves-fallback" />;
  }

  if (!shouldRender) return null;

  return <GradientWaves {...props} />;
}
