import { useEffect, useRef, type RefObject } from "react";

interface QuestionSwipeOptions {
  /** Scroll container that receives the touches (the quiz content area). */
  containerRef: RefObject<HTMLElement | null>;
  /** Element that follows the finger and animates out on a committed swipe. */
  stageRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Called for a "next" swipe when no further question is loaded yet. */
  onNextUnavailable?: () => void;
}

const INTENT_SLOP = 10;
const EXIT_MS = 170;
const SETTLE_MS = 280;
const SETTLE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const EXIT_EASE = "cubic-bezier(0.4, 0, 1, 1)";

/** True when the touch began inside content that scrolls horizontally on its own. */
function startsInHorizontalScroller(target: EventTarget | null, boundary: HTMLElement): boolean {
  let node = target instanceof Element ? target : null;
  while (node && node !== boundary) {
    if (node instanceof HTMLElement && node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Horizontal swipe navigation: right-to-left opens the next question and
 * left-to-right the previous one. The stage tracks the finger, rubber-bands
 * at the ends, and either slides out or springs back on release.
 */
export function useQuestionSwipe(options: QuestionSwipeOptions) {
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const { containerRef, enabled } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let mode: "idle" | "pending" | "dragging" | "ignored" = "idle";
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let lastDx = 0;
    let suppressClickUntil = 0;
    let exitTimer: number | undefined;

    const stage = () => latest.current.stageRef.current;

    const settle = (element: HTMLElement | null) => {
      if (!element) return;
      element.style.transition = reducedMotion ? "none" : `transform ${SETTLE_MS}ms ${SETTLE_EASE}, opacity ${SETTLE_MS}ms ${SETTLE_EASE}`;
      element.style.transform = "";
      element.style.opacity = "";
      window.setTimeout(() => {
        if (element.style.transform === "") element.style.transition = "";
      }, SETTLE_MS + 20);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || exitTimer !== undefined) {
        mode = "ignored";
        return;
      }
      if (startsInHorizontalScroller(event.target, container)) {
        mode = "ignored";
        return;
      }
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = performance.now();
      lastDx = 0;
      mode = "pending";
    };

    const onTouchMove = (event: TouchEvent) => {
      if (mode === "idle" || mode === "ignored") return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (mode === "pending") {
        if (Math.abs(dx) < INTENT_SLOP && Math.abs(dy) < INTENT_SLOP) return;
        if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
          mode = "ignored"; // Vertical scroll wins.
          return;
        }
        mode = "dragging";
        const element = stage();
        if (element) {
          element.style.animation = "none";
          element.style.transition = "none";
        }
      }

      event.preventDefault();
      lastDx = dx;
      const element = stage();
      if (!element) return;
      const { canNext, canPrev } = latest.current;
      const allowed = dx < 0 ? canNext : canPrev;
      const offset = allowed ? dx : dx * 0.22;
      const width = container.clientWidth || 1;
      element.style.transform = `translate3d(${offset}px, 0, 0)`;
      element.style.opacity = String(1 - Math.min(Math.abs(offset) / width, 1) * 0.45);
    };

    const onTouchEnd = () => {
      if (mode !== "dragging") {
        mode = "idle";
        return;
      }
      mode = "idle";
      suppressClickUntil = performance.now() + 400;

      const element = stage();
      const dx = lastDx;
      const width = container.clientWidth || 1;
      const velocity = Math.abs(dx) / Math.max(performance.now() - startTime, 1);
      const passed = Math.abs(dx) > width * 0.2 || (Math.abs(dx) > 40 && velocity > 0.45);
      const goingNext = dx < 0;
      const { canNext, canPrev, onNext, onPrev, onNextUnavailable } = latest.current;

      if (!passed || (goingNext ? !canNext : !canPrev)) {
        settle(element);
        if (passed && goingNext && !canNext) onNextUnavailable?.();
        return;
      }

      const navigate = goingNext ? onNext : onPrev;
      if (!element || reducedMotion) {
        if (element) settle(element);
        navigate();
        return;
      }

      element.style.transition = `transform ${EXIT_MS}ms ${EXIT_EASE}, opacity ${EXIT_MS}ms ${EXIT_EASE}`;
      element.style.transform = `translate3d(${goingNext ? -width * 0.4 : width * 0.4}px, 0, 0)`;
      element.style.opacity = "0";
      exitTimer = window.setTimeout(() => {
        exitTimer = undefined;
        navigate();
        // The stage remounts for the new question; restore it if it did not.
        requestAnimationFrame(() => {
          if (element.isConnected) settle(element);
        });
      }, EXIT_MS);
    };

    const onTouchCancel = () => {
      if (mode === "dragging") settle(stage());
      mode = "idle";
    };

    // A drag that ends over an answer must not also select it.
    const onClickCapture = (event: MouseEvent) => {
      if (performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchCancel);
    container.addEventListener("click", onClickCapture, true);

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchCancel);
      container.removeEventListener("click", onClickCapture, true);
      if (exitTimer !== undefined) {
        window.clearTimeout(exitTimer);
        settle(stage());
      }
    };
  }, [containerRef, enabled]);
}
