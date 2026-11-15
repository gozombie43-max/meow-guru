import React from 'react';

export function QuizThemeStyles({ cssClassName }: { cssClassName: string }) {
  return (
    <style jsx global>{`
      .${cssClassName} {
        --quiz-text: var(--light-text);
        --quiz-pill-bg: var(--light-border);
        --quiz-pill-text: var(--light-accent);
        --quiz-pill-border: rgba(0, 113, 227, 0.25);
        --quiz-quote-bg: rgba(0, 113, 227, 0.12);
        --quiz-quote-border: rgba(0, 113, 227, 0.35);
        --quiz-quote-text: var(--light-accent);
        --text-primary: var(--quiz-text);
      }

      .${cssClassName}[data-theme="dark"] {
        color-scheme: dark;
        --quiz-text: #F1F4F8;
        --quiz-pill-bg: rgb(var(--ios-system-blue-rgb) / 0.12);
        --quiz-pill-text: #8cb0de;
        --quiz-pill-border: rgb(var(--ios-system-blue-rgb) / 0.25);
        --quiz-quote-bg: rgb(var(--ios-system-blue-rgb) / 0.16);
        --quiz-quote-border: var(--ios-system-blue);
        --quiz-quote-text: #8cb0de;
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
    `}</style>
  );
}
