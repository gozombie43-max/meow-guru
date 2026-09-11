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
        --quiz-bg: #0D0F12;
        --quiz-start-bg: #0D0F12;
        --quiz-text: #E7E9EC;
        --quiz-text-muted: #989EA7;
        --quiz-text-soft: #747B85;
        --quiz-surface: #13161A;
        --quiz-surface-muted: #181C21;
        --quiz-nav-bg: #13161A;
        --quiz-nav-inner-bg: #181C21;
        --quiz-nav-border: #292E35;
        --quiz-card-bg: #13161A;
        --quiz-card-border: #292E35;
        --quiz-card-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
        --quiz-card-blur: blur(0px);
        --quiz-border: #292E35;
        --quiz-border-strong: #373E47;
        --quiz-divider: #292E35;
        --quiz-pill-bg: rgba(114, 150, 196, 0.16);
        --quiz-pill-text: #E7E9EC;
        --quiz-pill-border: #292E35;
        --quiz-accent-bg: #17263A;
        --quiz-accent-border: #7296C4;
        --quiz-accent-text: #7296C4;
        --quiz-overlay: rgba(0, 0, 0, 0.6);
        --quiz-option-bg: #13161A;
        --quiz-option-border: #292E35;
        --quiz-option-hover-bg: #181C21;
        --quiz-option-hover-border: rgba(114, 150, 196, 0.4);
        --quiz-option-text: #E7E9EC;
        --quiz-option-label-bg: #181C21;
        --quiz-option-label-border: #292E35;
        --quiz-option-label-text: #989EA7;
        --quiz-option-shadow: none;
        --quiz-option-selected-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
        --quiz-option-selected-bg: #17263A;
        --quiz-option-selected-border: #7296C4;
        --quiz-option-selected-label-bg: #3D6A9E;
        --quiz-option-selected-label-border: #7296C4;
        --quiz-option-selected-label-text: #ffffff;
        --quiz-option-correct-bg: #13161A;
        --quiz-option-correct-border: #292E35;
        --quiz-option-correct-label-bg: #287542;
        --quiz-option-correct-label-border: #287542;
        --quiz-option-correct-label-text: #ffffff;
        --quiz-option-wrong-bg: #13161A;
        --quiz-option-wrong-border: #292E35;
        --quiz-option-wrong-label-bg: #a33b36;
        --quiz-option-wrong-label-border: #a33b36;
        --quiz-option-wrong-label-text: #ffffff;
        --quiz-footer-bg: #13161A;
        --quiz-secondary-bg: #181C21;
        --quiz-secondary-border: #292E35;
        --quiz-secondary-text: #E7E9EC;
        --quiz-error-bg: rgba(163, 59, 54, 0.16);
        --quiz-error-border: rgba(163, 59, 54, 0.35);
        --quiz-error-text: #fca5a5;
        --quiz-ring-track: rgba(255, 255, 255, 0.08);
        --quiz-quote-bg: rgba(114, 150, 196, 0.16);
        --quiz-quote-border: #292E35;
        --quiz-quote-text: #7296C4;
        --quiz-selected-icon: #7296C4;
        --quiz-toggle-bg: #181C21;
        --quiz-toggle-border: #292E35;
        --quiz-toggle-track: #0D0F12;
        --quiz-toggle-thumb: linear-gradient(135deg, #292E35 0%, #181C21 100%);
        --quiz-status-current-bg: #3D6A9E;
        --quiz-status-current-text: #ffffff;
        --quiz-status-current-border: #7296C4;
        --quiz-status-current-shadow: 0 4px 14px rgba(61, 106, 158, 0.4);
        --quiz-status-answered-bg: rgba(40, 117, 66, 0.18);
        --quiz-status-answered-text: #4ade80;
        --quiz-status-answered-border: rgba(40, 117, 66, 0.6);
        --quiz-status-correct-bg: rgba(40, 117, 66, 0.22);
        --quiz-status-correct-text: #E7E9EC;
        --quiz-status-correct-border: #287542;
        --quiz-status-wrong-bg: rgba(163, 59, 54, 0.22);
        --quiz-status-wrong-text: #E7E9EC;
        --quiz-status-wrong-border: #a33b36;
        --quiz-status-empty-bg: #181C21;
        --quiz-status-empty-text: #989EA7;
        --quiz-status-empty-border: #292E35;
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

