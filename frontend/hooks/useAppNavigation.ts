"use client";
import { useEffect, useEffectEvent, useMemo } from "react";
import { useRouter } from "next/navigation";
import { navigationController } from "@/lib/navigation-controller";

export function useBackLayer(open: boolean, onClose: () => void) {
  const close = useEffectEvent(onClose);
  useEffect(() => {
    if (open) return navigationController().addLayer(() => close());
  }, [open]);
}

export function useQuizLeaveGuard(active: boolean, fallback: string, message = "Leave this quiz? Your current session will close. Any unsaved progress may be lost.") {
  useEffect(() => {
    if (active) return navigationController().addGuard(message, fallback);
  }, [active, fallback, message]);
}

/** Page Back goes to its known parent instead of guessing from history.length. */
export function useAppNavigation() {
  const router = useRouter();
  return useMemo(() => ({
    back: (parent: string) => navigationController().back(() => router.replace(parent)),
    push: (href: string) => navigationController().navigate(() => router.push(href)),
    replace: (href: string) => navigationController().navigate(() => router.replace(href)),
  }), [router]);
}
