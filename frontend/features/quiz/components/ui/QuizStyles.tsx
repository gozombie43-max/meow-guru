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
        --quiz-bg: #080C14;
        --quiz-start-bg: #080C14;
        --quiz-text: #F1F4F8;
        --quiz-text-muted: #929DB0;
        --quiz-text-soft: #606F85;
        --quiz-surface: #121722;
        --quiz-surface-muted: #171D29;
        --quiz-nav-bg: #121722;
        --quiz-nav-inner-bg: #171D29;
        --quiz-nav-border: rgba(255, 255, 255, 0.08);
        --quiz-card-bg: #121722;
        --quiz-card-border: rgba(255, 255, 255, 0.08);
        --quiz-card-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
        --quiz-card-blur: blur(0px);
        --quiz-border: rgba(255, 255, 255, 0.08);
        --quiz-border-strong: rgba(255, 255, 255, 0.12);
        --quiz-divider: rgba(255, 255, 255, 0.08);
        --quiz-pill-bg: rgba(95, 143, 200, 0.12);
        --quiz-pill-text: #8cb0de;
        --quiz-pill-border: rgba(95, 143, 200, 0.25);
        --quiz-accent-bg: rgba(95, 143, 200, 0.16);
        --quiz-accent-border: #5F8FC8;
        --quiz-accent-text: #5F8FC8;
        --quiz-overlay: rgba(0, 0, 0, 0.65);
        --quiz-option-bg: #171D29;
        --quiz-option-border: rgba(255, 255, 255, 0.06);
        --quiz-option-hover-bg: #1C2331;
        --quiz-option-hover-border: rgba(95, 143, 200, 0.35);
        --quiz-option-text: #F1F4F8;
        --quiz-option-label-bg: rgba(255, 255, 255, 0.06);
        --quiz-option-label-border: rgba(255, 255, 255, 0.06);
        --quiz-option-label-text: #929DB0;
        --quiz-option-shadow: none;
        --quiz-option-selected-shadow: none;
        --quiz-option-selected-bg: rgba(95, 143, 200, 0.16);
        --quiz-option-selected-border: #5F8FC8;
        --quiz-option-selected-label-bg: #5F8FC8;
        --quiz-option-selected-label-border: #5F8FC8;
        --quiz-option-selected-label-text: #ffffff;
        --quiz-option-correct-bg: rgba(34, 197, 94, 0.14);
        --quiz-option-correct-border: rgba(34, 197, 94, 0.45);
        --quiz-option-correct-label-bg: #16a34a;
        --quiz-option-correct-label-border: #16a34a;
        --quiz-option-correct-label-text: #ffffff;
        --quiz-option-wrong-bg: rgba(239, 68, 68, 0.14);
        --quiz-option-wrong-border: rgba(239, 68, 68, 0.45);
        --quiz-option-wrong-label-bg: #dc2626;
        --quiz-option-wrong-label-border: #dc2626;
        --quiz-option-wrong-label-text: #ffffff;
        --quiz-footer-bg: #080C14;
        --quiz-secondary-bg: #171D29;
        --quiz-secondary-border: rgba(255, 255, 255, 0.08);
        --quiz-secondary-text: #F1F4F8;
        --quiz-error-bg: rgba(239, 68, 68, 0.14);
        --quiz-error-border: rgba(239, 68, 68, 0.45);
        --quiz-error-text: #f87171;
        --quiz-ring-track: rgba(255, 255, 255, 0.08);
        --quiz-quote-bg: rgba(95, 143, 200, 0.16);
        --quiz-quote-border: #5F8FC8;
        --quiz-quote-text: #8cb0de;
        --quiz-selected-icon: #5F8FC8;
        --quiz-toggle-bg: #121722;
        --quiz-toggle-border: rgba(255, 255, 255, 0.08);
        --quiz-toggle-track: #080C14;
        --quiz-toggle-thumb: linear-gradient(135deg, #171D29 0%, #121722 100%);
        --quiz-status-current-bg: #5F8FC8;
        --quiz-status-current-text: #ffffff;
        --quiz-status-current-border: #5F8FC8;
        --quiz-status-current-shadow: 0 2px 8px rgba(95, 143, 200, 0.35);
        --quiz-status-answered-bg: rgba(95, 143, 200, 0.12);
        --quiz-status-answered-text: #8cb0de;
        --quiz-status-answered-border: rgba(95, 143, 200, 0.3);
        --quiz-status-correct-bg: rgba(34, 197, 94, 0.18);
        --quiz-status-correct-text: #4ade80;
        --quiz-status-correct-border: rgba(34, 197, 94, 0.45);
        --quiz-status-wrong-bg: rgba(239, 68, 68, 0.18);
        --quiz-status-wrong-text: #f87171;
        --quiz-status-wrong-border: rgba(239, 68, 68, 0.45);
        --quiz-status-empty-bg: #171D29;
        --quiz-status-empty-text: #929DB0;
        --quiz-status-empty-border: rgba(255, 255, 255, 0.06);
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
        border: 1px solid var(--concept-border);
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
        background: rgba(18, 23, 34, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.04);
      }
      .${cssClassName}[data-theme="dark"] .glass-card:hover {
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
        border-color: rgba(95, 143, 200, 0.35);
      }
      .${cssClassName}[data-theme="dark"] .btn-outline {
        background: #171D29;
        border-color: rgba(255, 255, 255, 0.08);
        color: #F1F4F8;
      }
      .${cssClassName}[data-theme="dark"] .btn-outline:hover {
        background: #1C2331;
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
