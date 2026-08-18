import React from 'react';

export function QuizThemeStyles({ cssClassName }: { cssClassName: string }) {
  return (
    <style jsx global>{`
      .${cssClassName} {
        --quiz-bg: linear-gradient(165deg, #f5f0ff 0%, #eef2ff 38%, #f8faff 100%);
        --quiz-start-bg: radial-gradient(
            1200px 600px at 20% -10%,
            rgba(124, 58, 237, 0.12),
            transparent 60%
          ),
          radial-gradient(
            1000px 540px at 85% 110%,
            rgba(37, 99, 235, 0.12),
            transparent 62%
          ),
          linear-gradient(135deg, #faf8ff 0%, #eef4ff 45%, #faf8ff 100%);
        --quiz-text: #111827;
        --quiz-text-muted: #6b7280;
        --quiz-text-soft: #94a3b8;
        --quiz-surface: rgba(255, 255, 255, 0.95);
        --quiz-surface-muted: rgba(248, 250, 252, 0.95);
        --quiz-nav-bg: rgba(255, 255, 255, 0.9);
        --quiz-nav-inner-bg: rgba(241, 245, 249, 0.95);
        --quiz-nav-border: rgba(226, 232, 240, 0.9);
        --quiz-card-bg: #ffffff;
        --quiz-card-border: #e5e7eb;
        --quiz-card-shadow: 0 4px 20px rgba(124, 58, 237, 0.08);
        --quiz-card-blur: blur(0px);
        --quiz-border: #e5e7eb;
        --quiz-border-strong: #cbd5e1;
        --quiz-divider: #9ca3af;
        --quiz-pill-bg: #f5f3ff;
        --quiz-pill-text: #5b21b6;
        --quiz-pill-border: rgba(124, 58, 237, 0.25);
        --quiz-accent-bg: #ede9fe;
        --quiz-accent-border: rgba(124, 58, 237, 0.35);
        --quiz-accent-text: #7c3aed;
        --quiz-overlay: rgba(15, 23, 42, 0.45);
        --quiz-option-bg: #ffffff;
        --quiz-option-border: #e5e7eb;
        --quiz-option-hover-bg: #f5f3ff;
        --quiz-option-hover-border: #c4b5fd;
        --quiz-option-text: #111827;
        --quiz-option-label-bg: transparent;
        --quiz-option-label-border: #7c3aed;
        --quiz-option-label-text: #5b21b6;
        --quiz-option-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
        --quiz-option-selected-shadow: 0 12px 24px rgba(124, 58, 237, 0.22);
        --quiz-option-selected-bg: #f5f3ff;
        --quiz-option-selected-border: #7c3aed;
        --quiz-option-selected-label-bg: #7c3aed;
        --quiz-option-selected-label-border: #7c3aed;
        --quiz-option-selected-label-text: #ffffff;
        --quiz-option-correct-bg: #f0fdf4;
        --quiz-option-correct-border: #16a34a;
        --quiz-option-correct-label-bg: #16a34a;
        --quiz-option-correct-label-border: #16a34a;
        --quiz-option-correct-label-text: #ffffff;
        --quiz-option-wrong-bg: #fef2f2;
        --quiz-option-wrong-border: #dc2626;
        --quiz-option-wrong-label-bg: #dc2626;
        --quiz-option-wrong-label-border: #dc2626;
        --quiz-option-wrong-label-text: #ffffff;
        --quiz-footer-bg: rgba(255, 255, 255, 0.95);
        --quiz-secondary-bg: #f1f5f9;
        --quiz-secondary-border: #cbd5e1;
        --quiz-secondary-text: #475569;
        --quiz-error-bg: #fff1f2;
        --quiz-error-border: #fecdd3;
        --quiz-error-text: #be123c;
        --quiz-ring-track: rgba(15, 23, 42, 0.08);
        --quiz-quote-bg: rgba(124, 58, 237, 0.12);
        --quiz-quote-border: rgba(124, 58, 237, 0.35);
        --quiz-quote-text: #5b21b6;
        --quiz-selected-icon: #7c3aed;
        --quiz-toggle-bg: rgba(255, 255, 255, 0.9);
        --quiz-toggle-border: rgba(148, 163, 184, 0.45);
        --quiz-toggle-track: rgba(226, 232, 240, 0.9);
        --quiz-toggle-thumb: linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%);
        --quiz-status-current-bg: #7c3aed;
        --quiz-status-current-text: #ffffff;
        --quiz-status-current-border: #7c3aed;
        --quiz-status-current-shadow: 0 10px 25px rgba(124, 58, 237, 0.45);
        --quiz-status-answered-bg: #fef3c7;
        --quiz-status-answered-text: #b45309;
        --quiz-status-answered-border: #fcd34d;
        --quiz-status-correct-bg: #dcfce7;
        --quiz-status-correct-text: #15803d;
        --quiz-status-correct-border: #86efac;
        --quiz-status-wrong-bg: #ffe4e6;
        --quiz-status-wrong-text: #be123c;
        --quiz-status-wrong-border: #fda4af;
        --quiz-status-empty-bg: #f1f5f9;
        --quiz-status-empty-text: #475569;
        --quiz-status-empty-border: #cbd5e1;
        --text-primary: var(--quiz-text);
      }

      .${cssClassName}[data-theme="dark"] {
        color-scheme: dark;
        --quiz-bg: linear-gradient(165deg, #0b1020 0%, #0f172a 45%, #0b0f1a 100%);
        --quiz-start-bg: radial-gradient(
            900px 420px at 20% -10%,
            rgba(124, 58, 237, 0.22),
            transparent 60%
          ),
          radial-gradient(
            900px 500px at 85% 110%,
            rgba(37, 99, 235, 0.2),
            transparent 62%
          ),
          linear-gradient(150deg, #0b1020 0%, #0f172a 40%, #0b0f1a 100%);
        --quiz-text: #ffffff;
        --quiz-text-muted: #94a3b8;
        --quiz-text-soft: #7683a2;
        --quiz-surface: #141b2d;
        --quiz-surface-muted: #101728;
        --quiz-nav-bg: #131a2a;
        --quiz-nav-inner-bg: #0f1525;
        --quiz-nav-border: #232c42;
        --quiz-card-bg: linear-gradient(
          150deg,
          rgba(255, 255, 255, 0.14) 0%,
          rgba(255, 255, 255, 0.1) 45%,
          rgba(148, 163, 184, 0.08) 100%
        );
        --quiz-card-border: rgba(255, 255, 255, 0.28);
        --quiz-card-shadow: 0 22px 40px rgba(2, 6, 23, 0.55),
          0 0 22px rgba(99, 102, 241, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.35),
          inset 0 -12px 24px rgba(2, 6, 23, 0.28);
        --quiz-card-blur: blur(12px) saturate(150%);
        --quiz-border: #232c42;
        --quiz-border-strong: #2f3b56;
        --quiz-divider: #3b4866;
        --quiz-pill-bg: rgba(124, 58, 237, 0.18);
        --quiz-pill-text: #c4b5fd;
        --quiz-pill-border: rgba(124, 58, 237, 0.45);
        --quiz-accent-bg: rgba(124, 58, 237, 0.2);
        --quiz-accent-border: rgba(124, 58, 237, 0.5);
        --quiz-accent-text: #ddd6fe;
        --quiz-overlay: rgba(2, 6, 23, 0.65);
        --quiz-option-bg: #151c2d;
        --quiz-option-border: #2b3550;
        --quiz-option-hover-bg: #1a2340;
        --quiz-option-hover-border: #7c3aed;
        --quiz-option-text: #ffffff;
        --quiz-option-label-bg: #0f1525;
        --quiz-option-label-border: #2b3550;
        --quiz-option-label-text: #cbd5f5;
        --quiz-option-shadow: 0 10px 22px rgba(2, 6, 23, 0.45);
        --quiz-option-selected-shadow: 0 16px 28px rgba(124, 58, 237, 0.4);
        --quiz-option-selected-bg: rgba(124, 58, 237, 0.35);
        --quiz-option-selected-border: #8b5cf6;
        --quiz-option-selected-label-bg: #8b5cf6;
        --quiz-option-selected-label-border: #8b5cf6;
        --quiz-option-selected-label-text: #ffffff;
        --quiz-option-correct-bg: rgba(22, 163, 74, 0.18);
        --quiz-option-correct-border: #16a34a;
        --quiz-option-correct-label-bg: #16a34a;
        --quiz-option-correct-label-border: #16a34a;
        --quiz-option-correct-label-text: #ffffff;
        --quiz-option-wrong-bg: rgba(220, 38, 38, 0.18);
        --quiz-option-wrong-border: #dc2626;
        --quiz-option-wrong-label-bg: #dc2626;
        --quiz-option-wrong-label-border: #dc2626;
        --quiz-option-wrong-label-text: #ffffff;
        --quiz-footer-bg: rgba(12, 16, 30, 0.95);
        --quiz-secondary-bg: #1b2337;
        --quiz-secondary-border: #2f3b56;
        --quiz-secondary-text: #e2e8f0;
        --quiz-error-bg: rgba(248, 113, 113, 0.16);
        --quiz-error-border: rgba(248, 113, 113, 0.35);
        --quiz-error-text: #fca5a5;
        --quiz-ring-track: rgba(226, 232, 240, 0.08);
        --quiz-quote-bg: rgba(124, 58, 237, 0.22);
        --quiz-quote-border: rgba(124, 58, 237, 0.5);
        --quiz-quote-text: #e9d5ff;
        --quiz-selected-icon: #c4b5fd;
        --quiz-toggle-bg: #121826;
        --quiz-toggle-border: #1f2a3d;
        --quiz-toggle-track: #0b1020;
        --quiz-toggle-thumb: linear-gradient(135deg, #1f2937 0%, #0b1020 100%);
        --quiz-status-current-bg: #8b5cf6;
        --quiz-status-current-text: #ffffff;
        --quiz-status-current-border: #a78bfa;
        --quiz-status-current-shadow: 0 14px 26px rgba(124, 58, 237, 0.5);
        --quiz-status-answered-bg: rgba(34, 197, 94, 0.18);
        --quiz-status-answered-text: #4ade80;
        --quiz-status-answered-border: rgba(34, 197, 94, 0.6);
        --quiz-status-correct-bg: rgba(34, 197, 94, 0.22);
        --quiz-status-correct-text: #4ade80;
        --quiz-status-correct-border: rgba(34, 197, 94, 0.7);
        --quiz-status-wrong-bg: rgba(244, 63, 94, 0.22);
        --quiz-status-wrong-text: #fb7185;
        --quiz-status-wrong-border: rgba(244, 63, 94, 0.6);
        --quiz-status-empty-bg: rgba(15, 23, 42, 0.9);
        --quiz-status-empty-text: #94a3b8;
        --quiz-status-empty-border: #2b3550;
      }

      .${cssClassName} .quiz-start {
        background: var(--quiz-start-bg);
        color: var(--quiz-text);
      }

      .${cssClassName} .qstatus {
        border: 1px solid var(--quiz-status-empty-border);
      }
      .${cssClassName} .qstatus--current {
        background: var(--quiz-status-current-bg);
        color: var(--quiz-status-current-text);
        border-color: var(--quiz-status-current-border);
        box-shadow: var(--quiz-status-current-shadow);
        transform: scale(1.1);
        z-index: 10;
      }
      .${cssClassName} .qstatus--answered {
        background: var(--quiz-status-answered-bg);
        color: var(--quiz-status-answered-text);
        border-color: var(--quiz-status-answered-border);
      }
      .${cssClassName} .qstatus--correct {
        background: var(--quiz-status-correct-bg);
        color: var(--quiz-status-correct-text);
        border-color: var(--quiz-status-correct-border);
      }
      .${cssClassName} .qstatus--wrong {
        background: var(--quiz-status-wrong-bg);
        color: var(--quiz-status-wrong-text);
        border-color: var(--quiz-status-wrong-border);
      }
      .${cssClassName} .qstatus--empty {
        background: var(--quiz-status-empty-bg);
        color: var(--quiz-status-empty-text);
        border-color: var(--quiz-status-empty-border);
      }

      .${cssClassName} .concept-badge {
        border: 1.5px solid var(--concept-border);
        border-radius: 999px;
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 600;
        text-transform: lowercase;
        color: var(--concept-text);
        background: var(--concept-bg);
        letter-spacing: 0.04em;
      }
      .${cssClassName}[data-theme="dark"] .concept-badge {
        border-color: var(--quiz-pill-border);
        background: var(--quiz-pill-bg);
        color: var(--quiz-pill-text);
      }

      .${cssClassName} .quote-highlight {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        margin: 0 2px;
        border-radius: 10px;
        border: 1px solid var(--quiz-quote-border);
        background: var(--quiz-quote-bg);
        color: var(--quiz-quote-text);
        font-weight: 600;
      }

      .${cssClassName} .quiz-option {
        border-radius: 18px;
        box-shadow: var(--quiz-option-shadow);
      }
      .${cssClassName} .quiz-option.is-selected {
        box-shadow: var(--quiz-option-selected-shadow);
      }
      .${cssClassName} .quiz-option-letter {
        border-radius: 12px;
      }

      .${cssClassName} .qnum-chip {
        border-radius: 12px;
      }

      .${cssClassName} .quiz-icon-button {
        background: var(--quiz-surface);
        border: 1px solid var(--quiz-border);
        color: var(--quiz-text-muted);
      }
      .${cssClassName} .quiz-icon-button:hover {
        background: var(--quiz-surface-muted);
      }

      .${cssClassName} .quiz-bookmark:hover {
        background: var(--quiz-surface-muted);
      }

      .${cssClassName} .theme-toggle {
        width: 34px;
        height: 34px;
        padding: 0;
        border-radius: 999px;
        border: 0;
        background: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        box-shadow: none;
        transition: transform 0.18s ease, background 0.2s ease,
          border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .${cssClassName} .theme-toggle:hover {
        transform: translateY(-1px);
        background: var(--quiz-toggle-bg);
        box-shadow: none;
      }
      .${cssClassName} .theme-toggle:active {
        transform: translateY(0);
      }
      .${cssClassName} .theme-toggle-icon {
        width: 19px;
        height: 19px;
        transition: color 0.2s ease, transform 0.2s ease;
      }
      .${cssClassName} .theme-toggle:hover .theme-toggle-icon {
        transform: scale(1.05);
      }
      .${cssClassName} .theme-toggle--light .theme-toggle-icon {
        color: #f59e0b;
      }
      .${cssClassName} .theme-toggle--dark .theme-toggle-icon {
        color: #e2e8f0;
      }

      .${cssClassName}[data-theme="dark"] .glass-card {
        background: rgba(15, 23, 42, 0.55);
        border: 1px solid rgba(148, 163, 184, 0.25);
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }
      .${cssClassName}[data-theme="dark"] .glass-card:hover {
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
        border-color: rgba(148, 163, 184, 0.35);
      }
      .${cssClassName}[data-theme="dark"] .btn-outline {
        background: rgba(15, 23, 42, 0.4);
        border-color: rgba(148, 163, 184, 0.35);
        color: #e2e8f0;
      }
      .${cssClassName}[data-theme="dark"] .btn-outline:hover {
        background: rgba(30, 41, 59, 0.6);
      }

      .${cssClassName}.theme-switching .quiz-card,
      .${cssClassName}.theme-switching .glass-card,
      .${cssClassName}.theme-switching .quiz-option {
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        transition: none !important;
      }

      .${cssClassName}.theme-switching .quiz-start-button,
      .${cssClassName}.theme-switching .quiz-start-button::after,
      .${cssClassName}.theme-switching .quiz-start-icon {
        animation: none !important;
      }
    `}</style>
  );
}

