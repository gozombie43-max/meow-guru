"use client";

import { cn } from "@/lib/utils"; // or your cn utility

type Lang = "en" | "hi" | "bn";

const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हि" },
  { code: "bn", label: "বাং" },
];

interface LangToggleProps {
  active: Lang;
  loading?: boolean;
  onChange: (lang: Lang) => void;
}

export function LangToggle({ active, loading, onChange }: LangToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-blue-200 bg-white/60 backdrop-blur-sm px-1 py-0.5">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => onChange(code)}
          disabled={loading}
          className={cn(
            "text-[11px] font-semibold px-2 py-0.5 rounded-full transition-all duration-200",
            active === code
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-500 hover:text-blue-600 hover:bg-blue-50",
            loading && "opacity-50 cursor-not-allowed"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}