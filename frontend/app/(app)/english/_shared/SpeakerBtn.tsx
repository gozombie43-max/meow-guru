"use client";

import { useRef, useState } from "react";

const TICKS = Array.from({ length: 12 });

export function SpeakerBtn({ text, bengaliText, size = 22 }: { text: string; bengaliText?: string; size?: number }) {
  const [state, setState] = useState<"idle" | "loading" | "speaking">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Tap again to stop
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setState("idle");
      return;
    }

    setState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: text.trim(),
          bengaliText: bengaliText ? bengaliText.trim() : undefined
        }),
      });
      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay   = () => setState("speaking");
      audio.onended  = () => { setState("idle"); URL.revokeObjectURL(url); audioRef.current = null; };
      audio.onerror  = () => { setState("idle"); URL.revokeObjectURL(url); audioRef.current = null; };
      await audio.play();
    } catch {
      setState("idle");
    }
  };

  const speaking = state === "speaking";
  const loading  = state === "loading";

  return (
    <button
      className={`dt-speaker-btn ${speaking ? "speaking" : ""} ${loading ? "loading" : ""}`}
      onClick={handleClick}
      aria-label="Speak"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 48 48" width={size * 0.55} height={size * 0.55} fill="none">
        {loading ? (
          <g>
            {TICKS.map((_, i) => (
              <rect
                key={i}
                className="ios-tick"
                x="22.5"
                y="4"
                width="3"
                height="9"
                rx="1.5"
                fill="currentColor"
                transform={`rotate(${i * 30} 24 24)`}
                style={{ animationDelay: `${-1 + (i / 12)}s` }}
              />
            ))}
          </g>
        ) : (
          <g>
            {/* SF Symbols-style speaker cone */}
            <path
              d="M6 18v12h6.5l10.5 9.5V8.5L12.5 18H6z"
              fill="currentColor"
            />
            {/* wave arcs, drawn in one after another while speaking */}
            <path
              className={`ios-arc ios-arc-1 ${speaking ? "is-speaking" : ""}`}
              d="M29 17a10 10 0 0 1 0 14"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={speaking ? undefined : 0}
              style={!speaking ? { opacity: 0.3 } : undefined}
            />
            <path
              className={`ios-arc ios-arc-2 ${speaking ? "is-speaking" : ""}`}
              d="M34.5 11.5a18 18 0 0 1 0 25"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={speaking ? undefined : 100}
              style={!speaking ? { opacity: 0 } : undefined}
            />
            <path
              className={`ios-arc ios-arc-3 ${speaking ? "is-speaking" : ""}`}
              d="M40 6a26 26 0 0 1 0 36"
              stroke="currentColor"
              strokeWidth="2.8"
              strokeLinecap="round"
              fill="none"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset={speaking ? undefined : 100}
              style={!speaking ? { opacity: 0 } : undefined}
            />
          </g>
        )}
      </svg>
    </button>
  );
}

export default SpeakerBtn;
