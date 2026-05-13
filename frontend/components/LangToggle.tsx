"use client";

import { cn } from "@/lib/utils"; // or your cn utility
import { useEffect, useRef, useState } from "react";

type Lang = "en" | "hi" | "bn";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "bn", label: "বাংলা" },
];

interface LangToggleProps {
  active: Lang;
  loading?: boolean;
  onChange: (lang: Lang) => void;
}

export function LangToggle({ active, loading, onChange }: LangToggleProps) {
  const optionsRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<Lang, HTMLButtonElement | null>>({
    en: null,
    hi: null,
    bn: null,
  });
  const [sliderStyle, setSliderStyle] = useState({ width: 0, left: 0 });

  useEffect(() => {
    const updateSlider = () => {
      const activeButton = buttonRefs.current[active];
      const container = optionsRef.current;
      if (!activeButton || !container) return;

      setSliderStyle({
        width: activeButton.offsetWidth,
        left: activeButton.offsetLeft,
      });
    };

    updateSlider();
    window.addEventListener("resize", updateSlider);
    document.fonts?.ready.then(updateSlider);

    return () => window.removeEventListener("resize", updateSlider);
  }, [active]);

  return (
    <div
      className={cn(
        "inline-flex h-9 max-w-full select-none items-center rounded-[13px] bg-[#f2f2f3] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]",
        loading && "opacity-70"
      )}
      aria-label="Question language"
    >
      <div ref={optionsRef} className="relative flex h-8 items-center">
        <div
          className="absolute top-0 z-0 h-full transform-gpu rounded-[11px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.10)] transition-[transform,width] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: sliderStyle.width,
            transform: `translateX(${sliderStyle.left}px)`,
          }}
        />
        {LANGS.map(({ code, label }, index) => (
          <div key={code} className="contents">
            {index > 0 && (
              <div className="h-5 w-px shrink-0 bg-black/[0.06]" aria-hidden="true" />
            )}
            <button
              ref={(node) => {
                buttonRefs.current[code] = node;
              }}
              onClick={() => onChange(code)}
              disabled={loading}
              className={cn(
                "relative z-10 h-8 min-w-[62px] rounded-[11px] bg-transparent px-2.5 text-[12px] font-medium leading-none text-[#8e8e93] outline-none transition-[color,transform] duration-300 ease-out active:scale-[0.98]",
                active === code ? "text-black" : "hover:text-[#6e6e73]",
                loading && "cursor-not-allowed"
              )}
            >
              {label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
