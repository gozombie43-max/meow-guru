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
        "lang-toggle inline-flex h-9 max-w-full select-none items-center rounded-[13px] border border-[var(--lang-toggle-border)] bg-[var(--lang-toggle-bg)] p-0.5 shadow-[inset_0_1px_0_var(--lang-toggle-highlight)]",
        loading && "opacity-70"
      )}
      aria-label="Question language"
    >
      <div ref={optionsRef} className="relative flex h-8 items-center">
        <div
          className="lang-toggle-slider absolute top-0 z-0 h-full transform-gpu rounded-[11px] bg-[var(--lang-toggle-active-bg)] shadow-[var(--lang-toggle-active-shadow)] transition-[transform,width] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: sliderStyle.width,
            transform: `translateX(${sliderStyle.left}px)`,
          }}
        />
        {LANGS.map(({ code, label }, index) => (
          <div key={code} className="contents">
            {index > 0 && (
              <div className="lang-toggle-divider h-5 w-px shrink-0 bg-[var(--lang-toggle-divider)]" aria-hidden="true" />
            )}
            <button
              ref={(node) => {
                buttonRefs.current[code] = node;
              }}
              onClick={() => onChange(code)}
              disabled={loading}
              className={cn(
                "lang-toggle-option relative z-10 h-8 min-w-[62px] rounded-[11px] bg-transparent px-2.5 text-[12px] font-medium leading-none outline-none transition-[color,transform] duration-300 ease-out active:scale-[0.98]",
                active === code && "is-active",
                loading && "cursor-not-allowed"
              )}
            >
              {label}
            </button>
          </div>
        ))}
      </div>
      <style>{`
        .lang-toggle {
          --lang-toggle-bg: #E6EAEF;
          --lang-toggle-border: rgba(0, 0, 0, 0.08);
          --lang-toggle-highlight: rgba(255, 255, 255, 0.85);
          --lang-toggle-active-bg: #ffffff;
          --lang-toggle-active-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.06);
          --lang-toggle-divider: rgba(0, 0, 0, 0.08);
          --lang-toggle-text: #57606a;
          --lang-toggle-text-hover: #1d1d1f;
          --lang-toggle-text-active: #1d1d1f;
        }

        body.theme-dark .lang-toggle,
        .theme-dark .lang-toggle,
        [data-theme="dark"] .lang-toggle,
        .dark .lang-toggle {
          --lang-toggle-bg: #1c1c1e;
          --lang-toggle-border: rgba(255, 255, 255, 0.09);
          --lang-toggle-highlight: rgba(255, 255, 255, 0.04);
          --lang-toggle-active-bg: #2c2c2e;
          --lang-toggle-active-shadow: 0 2px 6px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12);
          --lang-toggle-divider: rgba(255, 255, 255, 0.08);
          --lang-toggle-text: rgba(235, 235, 245, 0.6);
          --lang-toggle-text-hover: rgba(235, 235, 245, 0.85);
          --lang-toggle-text-active: #ffffff;
        }

        body.theme-dark [data-theme="light"] .lang-toggle,
        .theme-dark [data-theme="light"] .lang-toggle,
        [data-theme="light"] .lang-toggle.lang-toggle {
          --lang-toggle-bg: #E6EAEF;
          --lang-toggle-border: rgba(0, 0, 0, 0.08);
          --lang-toggle-highlight: rgba(255, 255, 255, 0.85);
          --lang-toggle-active-bg: #ffffff;
          --lang-toggle-active-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.06);
          --lang-toggle-divider: rgba(0, 0, 0, 0.08);
          --lang-toggle-text: #57606a;
          --lang-toggle-text-hover: #1d1d1f;
          --lang-toggle-text-active: #1d1d1f;
        }

        .lang-toggle-option {
          color: var(--lang-toggle-text);
          font-weight: 500;
        }

        .lang-toggle-option:hover {
          color: var(--lang-toggle-text-hover);
        }

        .lang-toggle-option.is-active {
          color: var(--lang-toggle-text-active);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
