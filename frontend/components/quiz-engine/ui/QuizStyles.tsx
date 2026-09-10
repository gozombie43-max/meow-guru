import React from 'react';

export function QuizThemeStyles({ cssClassName }: { cssClassName: string }) {
  return (
    <style jsx global>{`
      .${cssClassName} {
        --quiz-bg: var(--light-canvas);
        --quiz-start-bg: var(--light-canvas);
        --quiz-text: var(--light-text);
        --quiz-text-muted: var(--light-text-secondary);
        --quiz-text-soft: var(--light-text-muted);
        --quiz-surface: #FFFFFF;
        --quiz-surface-muted: var(--light-canvas);
        --quiz-nav-bg: #FFFFFF;
        --quiz-nav-inner-bg: var(--light-border);
        --quiz-nav-border: var(--light-border);
        --quiz-card-bg: #FFFFFF;
        --quiz-card-border: var(--light-border);
        --quiz-card-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
        --quiz-card-blur: blur(0px);
        --quiz-border: var(--light-border);
        --quiz-border-strong: var(--light-border);
        --quiz-divider: var(--light-border);
        --quiz-pill-bg: var(--light-border);
        --quiz-pill-text: var(--light-accent);
        --quiz-pill-border: rgba(0, 113, 227, 0.25);
        --quiz-accent-bg: var(--light-border);
        --quiz-accent-border: rgba(0, 113, 227, 0.35);
        --quiz-accent-text: var(--light-accent);
        --quiz-overlay: rgba(15, 23, 42, 0.45);
        --quiz-option-bg: #FFFFFF;
        --quiz-option-border: var(--light-border);
        --quiz-option-hover-bg: var(--light-canvas);
        --quiz-option-hover-border: rgba(0, 113, 227, 0.35);
        --quiz-option-text: var(--light-text);
        --quiz-option-label-bg: var(--light-border);
        --quiz-option-label-border: var(--light-border);
        --quiz-option-label-text: var(--light-text);
        --quiz-option-shadow: none;
        --quiz-option-selected-shadow: 0 4px 14px rgba(0, 113, 227, 0.14);
        --quiz-option-selected-bg: var(--light-accent-soft);
        --quiz-option-selected-border: var(--light-accent);
        --quiz-option-selected-label-bg: var(--light-accent);
        --quiz-option-selected-label-border: var(--light-accent);
        --quiz-option-selected-label-text: #ffffff;
        --quiz-option-correct-bg: #FFFFFF;
        --quiz-option-correct-border: var(--light-border);
        --quiz-option-correct-label-bg: #16a34a;
        --quiz-option-correct-label-border: #16a34a;
        --quiz-option-correct-label-text: #ffffff;
        --quiz-option-wrong-bg: #FFFFFF;
        --quiz-option-wrong-border: var(--light-border);
        --quiz-option-wrong-label-bg: #dc2626;
        --quiz-option-wrong-label-border: #dc2626;
        --quiz-option-wrong-label-text: #ffffff;
        --quiz-footer-bg: #FFFFFF;
        --quiz-secondary-bg: var(--light-canvas);
        --quiz-secondary-border: var(--light-border);
        --quiz-secondary-text: var(--light-text-secondary);
        --quiz-error-bg: #fff1f2;
        --quiz-error-border: #fecdd3;
        --quiz-error-text: #be123c;
        --quiz-ring-track: rgba(15, 23, 42, 0.08);
        --quiz-quote-bg: rgba(0, 113, 227, 0.12);
        --quiz-quote-border: rgba(0, 113, 227, 0.35);
        --quiz-quote-text: var(--light-accent);
        --quiz-selected-icon: var(--light-accent);
        --quiz-toggle-bg: #FFFFFF;
        --quiz-toggle-border: var(--light-border);
        --quiz-toggle-track: var(--light-border);
        --quiz-toggle-thumb: linear-gradient(135deg, #ffffff 0%, var(--light-border) 100%);
        --quiz-status-current-bg: var(--light-accent);
        --quiz-status-current-text: #ffffff;
        --quiz-status-current-border: var(--light-accent);
        --quiz-status-current-shadow: 0 4px 14px rgba(0, 113, 227, 0.35);
        --quiz-status-answered-bg: #e8f5e9;
        --quiz-status-answered-text: #2e7d32;
        --quiz-status-answered-border: #a5d6a7;
        --quiz-status-correct-bg: #dcfce7;
        --quiz-status-correct-text: #15803d;
        --quiz-status-correct-border: #86efac;
        --quiz-status-wrong-bg: #ffebee;
        --quiz-status-wrong-text: #c62828;
        --quiz-status-wrong-border: #ef9a9a;
        --quiz-status-empty-bg: #FFFFFF;
        --quiz-status-empty-text: var(--light-text);
        --quiz-status-empty-border: var(--light-border);
        --text-primary: var(--quiz-text);
      }

      .${cssClassName}[data-theme="dark"] {
        color-scheme: dark;
        --quiz-bg: var(--dark-canvas);
        --quiz-start-bg: var(--dark-canvas);
        --quiz-text: var(--dark-text);
        --quiz-text-muted: var(--dark-text-muted);
        --quiz-text-soft: var(--dark-text-muted);
        --quiz-surface: var(--dark-surface);
        --quiz-surface-muted: var(--dark-surface-muted);
        --quiz-nav-bg: #131a2a;
        --quiz-nav-inner-bg: #0f1525;
        --quiz-nav-border: var(--dark-border);
        --quiz-card-bg: var(--dark-surface);
        --quiz-card-border: var(--dark-border);
        --quiz-card-shadow: 0 22px 40px rgba(2, 6, 23, 0.55),
          0 0 22px rgba(99, 102, 241, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.35),
          inset 0 -12px 24px rgba(2, 6, 23, 0.28);
        --quiz-card-blur: blur(12px) saturate(150%);
        --quiz-border: var(--dark-border);
        --quiz-border-strong: #2f3b56;
        --quiz-divider: #3b4866;
        --quiz-pill-bg: rgba(124, 58, 237, 0.18);
        --quiz-pill-text: var(--dark-text);
        --quiz-pill-border: var(--dark-border);
        --quiz-accent-bg: rgba(124, 58, 237, 0.2);
        --quiz-accent-border: var(--dark-border);
        --quiz-accent-text: var(--dark-text);
        --quiz-overlay: rgba(2, 6, 23, 0.65);
        --quiz-option-bg: #151c2d;
        --quiz-option-border: var(--dark-border);
        --quiz-option-hover-bg: #1a2340;
        --quiz-option-hover-border: var(--dark-border);
        --quiz-option-text: var(--dark-text);
        --quiz-option-label-bg: #0f1525;
        --quiz-option-label-border: var(--dark-border);
        --quiz-option-label-text: var(--dark-text);
        --quiz-option-shadow: 0 10px 22px rgba(2, 6, 23, 0.45);
        --quiz-option-selected-shadow: 0 16px 28px rgba(124, 58, 237, 0.4);
        --quiz-option-selected-bg: rgba(124, 58, 237, 0.35);
        --quiz-option-selected-border: var(--dark-border);
        --quiz-option-selected-label-bg: #8b5cf6;
        --quiz-option-selected-label-border: var(--dark-border);
        --quiz-option-selected-label-text: var(--dark-text);
        --quiz-option-correct-bg: #151c2d;
        --quiz-option-correct-border: var(--dark-border);
        --quiz-option-correct-label-bg: #16a34a;
        --quiz-option-correct-label-border: var(--dark-border);
        --quiz-option-correct-label-text: var(--dark-text);
        --quiz-option-wrong-bg: #151c2d;
        --quiz-option-wrong-border: var(--dark-border);
        --quiz-option-wrong-label-bg: #dc2626;
        --quiz-option-wrong-label-border: var(--dark-border);
        --quiz-option-wrong-label-text: var(--dark-text);
        --quiz-footer-bg: rgba(12, 16, 30, 0.95);
        --quiz-secondary-bg: #1b2337;
        --quiz-secondary-border: var(--dark-border);
        --quiz-secondary-text: var(--dark-text);
        --quiz-error-bg: rgba(248, 113, 113, 0.16);
        --quiz-error-border: rgba(248, 113, 113, 0.35);
        --quiz-error-text: #fca5a5;
        --quiz-ring-track: rgba(226, 232, 240, 0.08);
        --quiz-quote-bg: rgba(124, 58, 237, 0.22);
        --quiz-quote-border: var(--dark-border);
        --quiz-quote-text: var(--dark-text);
        --quiz-selected-icon: #c4b5fd;
        --quiz-toggle-bg: #121826;
        --quiz-toggle-border: var(--dark-border);
        --quiz-toggle-track: #0b1020;
        --quiz-toggle-thumb: linear-gradient(135deg, #1f2937 0%, #0b1020 100%);
        --quiz-status-current-bg: #8b5cf6;
        --quiz-status-current-text: var(--dark-text);
        --quiz-status-current-border: var(--dark-border);
        --quiz-status-current-shadow: 0 14px 26px rgba(124, 58, 237, 0.5);
        --quiz-status-answered-bg: rgba(34, 197, 94, 0.18);
        --quiz-status-answered-text: #4ade80;
        --quiz-status-answered-border: rgba(34, 197, 94, 0.6);
        --quiz-status-correct-bg: rgba(34, 197, 94, 0.22);
        --quiz-status-correct-text: var(--dark-text);
        --quiz-status-correct-border: var(--dark-border);
        --quiz-status-wrong-bg: rgba(244, 63, 94, 0.22);
        --quiz-status-wrong-text: var(--dark-text);
        --quiz-status-wrong-border: var(--dark-border);
        --quiz-status-empty-bg: rgba(15, 23, 42, 0.9);
        --quiz-status-empty-text: var(--dark-text);
        --quiz-status-empty-border: var(--dark-border);
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

