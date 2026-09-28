"use client";

import { useEffect, useRef, useState } from "react";

const ease = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Presentation only: scoring remains immediate and authoritative. */
export function useQuizMotion(questionId: number | undefined, text: string) {
  const contentRef = useRef<HTMLElement>(null);
  const [reveal, setReveal] = useState<{ id: number; stage: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animations = useRef<Animation[]>([]);
  const navigating = useRef(false);
  const previous = useRef({ questionId, text });

  useEffect(() => {
    const changedQuestion = previous.current.questionId !== questionId;
    const changedText = previous.current.text !== text;
    previous.current = { questionId, text };
    navigating.current = false;
    if (changedQuestion) timers.current.forEach(clearTimeout);
    if (reduced() || (!changedQuestion && !changedText)) return;
    const nodes = contentRef.current?.querySelectorAll(".ios-series-metadata-trigger, .ios-series-question-card, .ios-series-options");
    animations.current.forEach(animation => animation.cancel());
    animations.current = Array.from(nodes ?? []).map(node => node.animate([
      { opacity: 0, transform: `translateX(${changedQuestion ? 8 : 0}px)` },
      { opacity: 1, transform: "translateX(0)" },
    ], { duration: changedQuestion ? 160 : 200, easing: ease }));
  }, [questionId, text]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    animations.current.forEach(animation => animation.cancel());
  }, []);

  const submit = (action: () => void) => {
    if (questionId === undefined) return;
    timers.current.forEach(clearTimeout);
    if (!reduced()) {
      setReveal({ id: questionId, stage: 0 });
      timers.current = [80, 160, 300].map((delay, index) => setTimeout(
        () => setReveal({ id: questionId, stage: index + 1 }), delay,
      ));
    }
    action();
  };

  const next = (action: () => void) => {
    if (navigating.current) return;
    if (reduced()) { action(); return; }
    navigating.current = true;
    const nodes = contentRef.current?.querySelectorAll(".ios-series-metadata-trigger, .ios-series-question-card, .ios-series-options");
    animations.current.forEach(animation => animation.cancel());
    animations.current = Array.from(nodes ?? []).map(node => node.animate([
      { opacity: 1, transform: "translateX(0)" },
      { opacity: 0, transform: "translateX(-8px)" },
    ], { duration: 150, easing: ease, fill: "forwards" }));
    timers.current.push(setTimeout(() => {
      animations.current.forEach(animation => animation.cancel());
      navigating.current = false;
      action();
    }, 150));
  };

  return { contentRef, submit, next, stage: reveal && reveal.id === questionId ? reveal.stage : 3 };
}
