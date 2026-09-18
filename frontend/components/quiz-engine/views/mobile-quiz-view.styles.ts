import css from "styled-jsx/css";

export const mobileQuizViewStyles = css.global`
        /* Refined Exam Dark Palette for Optimal Readability & Hierarchy */
        .ios-series-quiz[data-theme="dark"] {
          --dark-canvas: #090d12;
          --dark-surface: #131720;
          --dark-surface-muted: #1c222e;
          --dark-border: rgba(255, 255, 255, 0.07);
          --dark-text: #f0f6fc;
          --dark-text-secondary: #94a3b8;
          --dark-text-muted: #64748b;
          --dark-accent: #2563eb;
          --dark-accent-soft: rgba(37, 99, 235, 0.12);
          --dark-action: #2563eb;
          color: var(--dark-text);
          color-scheme: dark;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-prompt,
        .ios-series-quiz[data-theme="dark"] .ios-series-option-value {
          color: var(--dark-text);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-meta-row,
        .ios-series-quiz[data-theme="dark"] .ios-series-bookmark,
        .ios-series-quiz[data-theme="dark"] .ios-series-your-answer {
          color: var(--dark-text-secondary);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-icon-button.is-active {
          border-color: #2563eb;
          background: rgba(37, 99, 235, 0.15);
          color: #58a6ff;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option:not(:disabled):hover {
          border-color: rgba(37, 99, 235, 0.35);
          background: var(--dark-surface-muted);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-selected {
          border-color: #2563eb;
          background: rgba(37, 99, 235, 0.12);
          box-shadow: 0 0 0 1px #2563eb;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-selected .ios-series-option-letter,
        .ios-series-quiz[data-theme="dark"] .ios-series-palette-grid button.is-current {
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-correct .ios-series-option-letter {
          background: #16a34a;
          color: #ffffff;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-wrong .ios-series-option-letter {
          background: #dc2626;
          color: #ffffff;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-exam-details summary:focus-visible {
          outline-color: var(--dark-accent);
        }
        .ios-series-quiz {
          --ios-accent: var(--dark-accent);
          --ios-option-shadow: none;
          min-height: 100dvh;
          background: var(--dark-canvas);
          color: var(--dark-text);
          font-family:
            var(--font-noto-bengali), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
            "Noto Sans Bengali", "Hind Siliguri", "Noto Sans", "Helvetica Neue", Arial, sans-serif;
          font-kerning: normal;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }
        .ios-series-device {
          height: 100dvh;
          display: flex;
          flex-direction: column;
          max-width: 768px;
          margin: 0 auto;
          background: var(--dark-canvas);
          overflow: hidden;
          width: 100%;
        }
        .ios-series-quiz .ios-series-header,
        .ios-series-header {
          position: relative;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 8px;
          padding: calc(var(--safe-top) + 6px) max(14px, var(--safe-right)) 6px max(14px, var(--safe-left));
          flex: none;
          border-bottom: none !important;
          background: var(--dark-canvas);
        }
        .ios-series-header-left {
          display: flex;
          align-items: center;
          justify-self: start;
        }
        .ios-series-header-center {
          display: flex;
          align-items: center;
          justify-self: center;
        }
        .ios-series-header-right {
          display: flex;
          align-items: center;
          justify-self: end;
          gap: 7px;
        }
        .ios-series-header > *:first-child {
          justify-self: start;
        }
        .ios-series-header > *:nth-child(2) {
          justify-self: center;
        }
        .ios-series-header > *:last-child {
          justify-self: end;
        }
        @media (max-width: 360px) {
          .ios-series-header {
            gap: 4px;
            padding: calc(var(--safe-top) + 4px) max(8px, var(--safe-right)) 4px max(8px, var(--safe-left));
          }
          .ios-series-header-right {
            gap: 5px;
          }
          .ios-series-header .lang-toggle-option {
            padding-left: 6px !important;
            padding-right: 6px !important;
            font-size: 11px !important;
          }
        }
        .ios-series-quiz .ios-series-icon-button,
        .ios-series-quiz .ios-series-icon-button[data-ui-button],
        .ios-series-header .ios-series-icon-button,
        .ios-series-icon-button {
          width: 34px !important;
          height: 34px !important;
          min-width: 34px !important;
          min-height: 34px !important;
          max-width: 34px !important;
          max-height: 34px !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 1px solid var(--dark-border);
          border-radius: 9px;
          color: var(--dark-text);
          background: var(--dark-surface);
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 12.5px;
          font-weight: 600;
          white-space: nowrap;
          box-sizing: border-box;
          flex-shrink: 0;
        }
        .ios-series-icon-button:active {
          transform: scale(0.96);
        }
        .ios-series-icon-button.is-active {
          border-color: var(--dark-accent) !important;
          background: var(--dark-accent-soft) !important;
          color: var(--dark-accent) !important;
        }
        .ios-series-icon-button.is-qnum {
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
        }
        .ios-series-icon-button.is-qnum-sm {
          width: 34px !important;
          min-width: 34px !important;
          padding: 0 2px;
          font-size: 12.5px;
          letter-spacing: -0.01em;
        }
        .ios-series-icon-button.is-qnum-md {
          width: 34px !important;
          min-width: 34px !important;
          padding: 0 2px;
          font-size: 11px;
          letter-spacing: -0.02em;
        }
        .ios-series-icon-button.is-qnum-lg,
        .ios-series-quiz .ios-series-icon-button.is-qnum-lg {
          width: 38px !important;
          min-width: 38px !important;
          max-width: 38px !important;
          padding: 0 2px;
          font-size: 10px;
          letter-spacing: -0.03em;
        }
        .ios-series-palette-num {
          display: inline-block;
          line-height: 1;
          font-weight: 700;
          text-align: center;
        }
        .ios-series-icon-button svg {
          width: 17px !important;
          height: 17px !important;
          stroke-width: 2;
        }
        .ios-series-quiz .lang-toggle {
          display: inline-flex;
          align-items: center;
          height: 34px !important;
          min-height: 34px !important;
          padding: 2.5px !important;
          border-radius: 11px !important;
          border: 1px solid var(--lang-toggle-border) !important;
          box-shadow: none !important;
          background: var(--lang-toggle-bg);
          box-sizing: border-box;
        }
        .ios-series-quiz .lang-toggle > div {
          height: 27px !important;
          display: flex !important;
          align-items: center !important;
          position: relative !important;
        }
        .ios-series-quiz .lang-toggle-slider {
          height: 100% !important;
          border-radius: 8.5px !important;
          background: var(--lang-toggle-active-bg) !important;
          box-shadow: var(--lang-toggle-active-shadow) !important;
        }
        .ios-series-quiz[data-theme="dark"] .lang-toggle.lang-toggle {
          --lang-toggle-bg: #12171E;
          --lang-toggle-border: #262C36;
          --lang-toggle-active-bg: #17263A;
          --lang-toggle-active-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 2px rgba(0, 0, 0, 0.35);
          --lang-toggle-divider: #262C36;
          --lang-toggle-text: #8B949E;
          --lang-toggle-text-active: #FFFFFF;
          --lang-toggle-text-hover: #C9D1D9;
          background: var(--lang-toggle-bg);
          border-color: var(--lang-toggle-border);
        }
        .ios-series-quiz .lang-toggle-option {
          min-height: 0 !important;
          min-width: 0 !important;
          height: 27px !important;
          padding-inline: 10px !important;
          font-size: 11.5px !important;
          font-weight: 500 !important;
          border-radius: 8.5px !important;
          line-height: 27px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: var(--lang-toggle-text);
        }
        .ios-series-quiz .lang-toggle-option.is-active {
          color: var(--lang-toggle-text-active) !important;
          font-weight: 600 !important;
        }
        .ios-series-quiz .lang-toggle-divider {
          height: 14px !important;
          width: 1px !important;
          background: var(--lang-toggle-divider) !important;
          margin: auto 0 !important;
        }
        .ios-series-quiz .ios-series-rail,
        .ios-series-rail {
          display: flex;
          gap: 6px;
          flex: none;
          align-items: center;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          padding: 4px max(12px, var(--safe-right)) 6px max(12px, var(--safe-left));
          border-bottom: none !important;
          border-top: none !important;
          scrollbar-width: none;
        }
        .ios-series-rail::-webkit-scrollbar {
          display: none;
        }
        .ios-series-question {
          position: relative;
          flex: 0 0 38px;
          width: 38px;
          height: 38px;
          padding: 0;
          border: 1px solid var(--dark-border);
          border-radius: 10px;
          background: var(--dark-surface);
          color: var(--dark-text-secondary);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition:
            background 140ms ease,
            color 140ms ease,
            border-color 140ms ease,
            transform 100ms ease;
        }
        .ios-series-question:active {
          transform: scale(0.95);
        }
        .ios-series-question.is-current {
          border-color: #2563eb !important;
          background: #2563eb !important;
          color: #ffffff !important;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4) !important;
        }
        .ios-series-question.is-correct,
        .ios-series-question.is-answered {
          border-color: var(--dark-border);
          background: var(--dark-surface);
          color: var(--dark-text-secondary);
        }
        .ios-series-question.is-correct::after,
        .ios-series-question.is-answered::after {
          content: "";
          position: absolute;
          bottom: 3.5px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #22c55e;
        }
        .ios-series-question.is-wrong {
          border-color: var(--dark-border);
          background: var(--dark-surface);
          color: var(--dark-text-secondary);
        }
        .ios-series-question.is-wrong::after {
          content: "";
          position: absolute;
          bottom: 3.5px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #ef4444;
        }
        .ios-series-question.is-unsubmitted {
          border-color: var(--dark-border);
          background: var(--dark-surface);
          color: var(--dark-text-secondary);
        }
        .ios-series-question.is-unsubmitted::after {
          content: "";
          position: absolute;
          bottom: 3.5px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #a855f7;
        }
        .ios-series-question.is-current::after {
          display: none !important;
        }
        .ios-series-content {
          flex: 1;
          min-height: 0;
          min-width: 0;
          overflow-y: auto;
          padding: 4px max(14px, var(--safe-right)) 12px max(14px, var(--safe-left));
          scrollbar-width: none;
          -ms-overflow-style: none;
          -webkit-overflow-scrolling: touch;
        }
        .ios-series-content::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .ios-series-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          min-height: 24px;
          margin-bottom: 6px;
          color: var(--dark-text-secondary);
          font-size: 12px;
          font-weight: 500;
          line-height: 1.35;
        }
        .ios-series-meta-items {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          flex: 1;
        }
        .ios-series-meta-icon {
          width: 13px;
          height: 13px;
          color: #388bfd;
          flex-shrink: 0;
        }
        .ios-series-meta-separator {
          flex: none;
          color: var(--dark-text-muted);
        }
        .ios-series-exam-label {
          min-width: 0;
          line-height: 1.35;
          font-size: 12px;
          color: var(--dark-text-secondary);
        }
        .ios-series-exam-details {
          position: relative;
          min-width: 0;
        }
        .ios-series-exam-details summary {
          min-width: 0;
          padding: 2px 4px;
          margin: -2px -4px;
          border-radius: 6px;
          color: var(--dark-text-secondary);
          line-height: 1.35;
          font-size: 12px;
          list-style: none;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .ios-series-exam-details summary::-webkit-details-marker {
          display: none;
        }
        .ios-series-exam-details summary:focus-visible {
          outline: 2px solid var(--dark-accent);
          outline-offset: 2px;
        }
        .ios-series-exam-details[open] summary {
          color: var(--dark-text);
          background: rgba(255, 255, 255, 0.08);
        }
        .ios-series-exam-popover {
          position: absolute;
          z-index: 40;
          top: calc(100% + 9px);
          left: 50%;
          width: max-content;
          max-width: min(260px, calc(100vw - 40px));
          padding: 9px 11px;
          border: 1px solid var(--dark-border);
          border-radius: 10px;
          color: var(--dark-text);
          background: var(--dark-surface-muted);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
          font-size: 11.5px;
          font-weight: 500;
          line-height: 1.4;
          transform: translateX(-50%);
        }
        .ios-series-quiz .concept-badge {
          flex: none;
          letter-spacing: 0;
          font-size: 12px;
          color: var(--dark-text-secondary);
        }
        .ios-series-question-card {
          position: relative;
          padding: 18px 20px;
          border: 1px solid rgba(255, 255, 255, 0.055);
          border-radius: 16px;
          background: #121620;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        .ios-series-timer {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 25px;
          padding: 0 8px;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: var(--dark-surface);
          color: var(--dark-text);
          font-size: 12px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
          flex-shrink: 0;
          margin-left: auto;
          user-select: none;
        }
        .ios-series-timer svg {
          width: 12px;
          height: 12px;
          color: var(--dark-text-muted);
          flex-shrink: 0;
        }
        .ios-series-bookmark {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          padding: 0;
          border: 0;
          border-radius: 0;
          color: var(--dark-text-secondary);
          background: transparent;
          cursor: pointer;
          flex-shrink: 0;
          margin-left: auto;
          transition:
            color 0.16s ease,
            transform 0.16s ease;
        }
        .ios-series-bookmark:active {
          color: var(--dark-text);
          transform: scale(0.92);
        }
        .ios-series-bookmark svg {
          width: 20px;
          height: 20px;
        }
        .ios-series-prompt {
          color: var(--dark-text);
          font-size: 19.5px;
          font-weight: 400;
          line-height: 1.62;
          letter-spacing: 0.005em;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .ios-series-prompt p {
          margin: 0;
          line-height: 1.62;
        }
        .ios-series-prompt p + p {
          margin-top: 12px;
          font-family: inherit;
          font-size: 19.5px;
          font-weight: 400;
          line-height: 1.62;
          letter-spacing: 0.005em;
        }
        .ios-series-quiz .ios-series-prompt .quote-highlight {
          font-weight: 500;
        }
        .ios-series-prompt :global(.katex),
        .ios-series-option-value :global(.katex) {
          font-weight: 400;
          line-height: 1.25;
          letter-spacing: normal;
        }
        .ios-series-prompt :global(.katex-html),
        .ios-series-option-value :global(.katex-html) {
          white-space: normal;
        }
        .ios-series-prompt :global(.katex-display) {
          margin: 12px 0;
          padding: 4px 0;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }
        .ios-series-option-value :global(.katex-display) {
          margin: 6px 0;
          padding: 2px 0;
          overflow-x: auto;
          overflow-y: hidden;
        }
        .ios-series-options {
          display: grid;
          gap: 9px;
          margin-top: 14px;
        }
        .ios-series-option {
          --ui-control-height: 52px;
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border: 1px solid rgba(255, 255, 255, 0.055);
          border-radius: 14px;
          background: var(--dark-surface);
          color: var(--dark-text);
          box-shadow: none;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.16s ease,
            border-color 0.16s ease,
            box-shadow 0.16s ease,
            opacity 0.16s ease,
            transform 0.16s ease;
        }
        .ios-series-option:not(:disabled):hover {
          border-color: rgba(37, 99, 235, 0.35);
          background: var(--dark-surface-muted);
        }
        .ios-series-option:not(:disabled):active {
          transform: scale(0.99);
        }
        .ios-series-quiz .ios-series-option:disabled,
        .ios-series-option:disabled {
          cursor: default;
          opacity: 1 !important;
        }
        .ios-series-option.is-selected {
          border-color: #2563eb;
          background: rgba(37, 99, 235, 0.12);
          box-shadow: 0 0 0 1px #2563eb;
        }
        .ios-series-option.is-correct {
          border-color: var(--dark-border);
          background: var(--dark-surface);
        }
        .ios-series-option.is-wrong {
          border-color: var(--dark-border);
          background: var(--dark-surface);
        }
        .ios-series-option.is-user-answer.is-correct {
          border-color: rgba(40, 117, 66, 0.5);
          box-shadow:
            0 0 0 1px rgba(40, 117, 66, 0.2);
        }
        .ios-series-option.is-user-answer.is-wrong {
          border-color: rgba(163, 59, 54, 0.5);
          box-shadow:
            0 0 0 1px rgba(163, 59, 54, 0.2);
        }
        .ios-series-quiz .ios-series-option.is-dimmed,
        .ios-series-option.is-dimmed {
          opacity: 0.6 !important;
        }
        .ios-series-option.is-user-answer {
          animation: ios-answer-reveal 0.26s cubic-bezier(0.2, 0.8, 0.3, 1);
        }
        .ios-series-option.is-correct {
          animation: ios-correct-glow 0.9s ease-out;
        }
        .ios-series-option.is-user-answer.is-correct {
          animation:
            ios-answer-reveal 0.26s cubic-bezier(0.2, 0.8, 0.3, 1),
            ios-correct-glow 0.9s ease-out;
        }
        @keyframes ios-answer-reveal {
          0%,
          100% {
            transform: scale(1);
          }
          48% {
            transform: scale(1.02);
          }
        }
        @keyframes ios-correct-glow {
          0% {
            box-shadow: none;
          }
          45% {
            box-shadow:
              0 0 0 3px rgba(40, 117, 66, 0.25),
              0 0 16px rgba(40, 117, 66, 0.2);
          }
          100% {
            box-shadow:
              0 0 0 1px rgba(40, 117, 66, 0.15);
          }
        }
        .ios-series-option-letter {
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          box-sizing: border-box;
          display: grid;
          place-items: center;
          border: 1px solid transparent;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          font-size: 14.5px;
          font-weight: 700;
          line-height: 1;
        }
        .ios-series-option.is-selected .ios-series-option-letter {
          border-color: transparent;
          background: #2563eb;
          color: #ffffff;
        }
        .ios-series-option.is-correct .ios-series-option-letter {
          border-color: transparent;
          background: #16a34a;
          color: #ffffff;
        }
        .ios-series-option.is-wrong .ios-series-option-letter {
          border-color: transparent;
          background: #dc2626;
          color: #ffffff;
        }
        .ios-series-option-value {
          min-width: 0;
          color: var(--dark-text);
          font-size: 17px;
          font-weight: 450;
          line-height: 1.55;
          letter-spacing: 0.005em;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        .ios-series-option-status {
          display: inline-flex;
          align-items: center;
          margin-left: auto;
          flex: none;
          width: 20px;
          justify-content: flex-end;
        }
        .ios-series-option-radio {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.2);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          transition: all 0.15s ease;
        }
        .ios-series-option-radio.is-selected {
          border-color: #2563eb;
          background: #2563eb;
          box-shadow: inset 0 0 0 3px var(--dark-surface);
        }
        .ios-series-option-radio.is-dimmed {
          opacity: 0.25;
        }
        .ios-series-your-answer {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip-path: inset(50%);
          white-space: nowrap;
        }
        .ios-series-answer-icon {
          width: 20px;
          height: 20px;
          flex: none;
        }
        .ios-series-option.is-correct .ios-series-answer-icon {
          color: #16a34a;
        }
        .ios-series-option.is-wrong .ios-series-answer-icon {
          color: #dc2626;
        }
        .ios-series-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 12px 0 16px;
        }
        .ios-series-actions.is-single-action {
          grid-template-columns: 1fr;
        }
        .ios-series-solution,
        .ios-series-ai-btn {
          width: 100%;
          min-width: 0;
          min-height: 44px;
          border: 1px solid var(--dark-border);
          border-radius: 12px;
          background: var(--dark-surface);
          color: var(--dark-text-secondary);
          font: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 0.16s ease,
            border-color 0.16s ease,
            transform 0.16s ease;
        }
        .ios-series-solution,
        .ios-series-ai-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
        }
        .ios-series-solution::before,
        .ios-series-ai-btn::before {
          content: "";
          display: block;
          width: 18px;
          height: 18px;
          flex: none;
          background-position: center;
          background-repeat: no-repeat;
          background-size: contain;
        }
        .ios-series-solution::before {
          background: linear-gradient(
            135deg,
            #ca5df5 0%,
            #806cea 32%,
            #4d77e3 58%,
            #0a85d9 100%
          );
          -webkit-mask: url("/icons8-view-solution.svg?v=3") center/contain
            no-repeat;
          mask: url("/icons8-view-solution.svg?v=3") center/contain no-repeat;
        }
        .ios-series-ai-btn::before {
          background-image: url("/icons8-gemini-ai.svg");
        }
        .ios-series-solution:active,
        .ios-series-ai-btn:active {
          border-color: var(--dark-accent);
          background: var(--dark-surface-muted);
          transform: scale(0.99);
        }
        .ios-series-error {
          margin: 10px 2px 0;
          color: #ff9f9a;
          font-size: 13px;
          font-weight: 500;
        }
        .ios-series-footer {
          position: relative;
          z-index: 30;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          width: 100%;
          max-width: 768px;
          margin: 0 auto;
          padding: 10px max(16px, var(--safe-right)) calc(var(--safe-bottom) + 12px) max(16px, var(--safe-left));
          border-top: 1px solid var(--dark-border);
          background: var(--dark-canvas);
          flex-shrink: 0;
        }
        .ios-series-footer button {
          --ui-control-height: 52px;
          position: relative;
          z-index: 30;
          min-width: 0;
          height: 52px;
          border-radius: 16px;
          font: inherit;
          font-size: 15.5px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;
        }
        .ios-series-btn-arrow,
        .ios-series-btn-icon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }
        .ios-series-footer button:active:not(:disabled) {
          transform: scale(0.97);
        }
        .ios-series-footer button:disabled {
          background: rgba(255, 255, 255, 0.035) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          color: rgba(255, 255, 255, 0.28) !important;
          box-shadow: none !important;
          cursor: not-allowed !important;
          opacity: 1 !important;
        }
        .ios-series-footer button:disabled svg {
          color: rgba(255, 255, 255, 0.22) !important;
        }
        .ios-series-footer-prev,
        .ios-series-footer-secondary {
          border: 1px solid var(--dark-border);
          background: var(--dark-surface);
          color: var(--dark-text);
        }
        .ios-series-footer-review {
          border: 1px solid rgba(56, 139, 253, 0.28);
          background: rgba(56, 139, 253, 0.14);
          color: #58a6ff;
        }
        .ios-series-footer-review.is-active {
          background: rgba(56, 139, 253, 0.26);
          border-color: #58a6ff;
          color: #79b8ff;
        }
        .ios-series-footer-next,
        .ios-series-footer-primary {
          border: 0;
          background: #2563eb;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
        }
        .ios-series-footer-next:not(:disabled):active,
        .ios-series-footer-primary:not(:disabled):active {
          transform: scale(0.97);
        }

        /* Modern Review Popover */
        .ios-series-review-backdrop {
          position: fixed;
          inset: 0;
          z-index: 20;
          background: rgba(0, 0, 0, 0.28);
          -webkit-tap-highlight-color: transparent;
        }
        .ios-series-review-panel {
          position: absolute;
          bottom: calc(100% + 12px);
          left: max(16px, var(--safe-left));
          right: max(16px, var(--safe-right));
          z-index: 35;
          background: #1c2128;
          border: 1px solid #30363d;
          border-radius: 20px;
          padding: 12px 14px 14px;
          box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.45), 0 4px 14px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ios-series-review-handle {
          width: 38px;
          height: 4px;
          border-radius: 9999px;
          background: #3d444d;
          margin: 0 auto 10px;
        }
        .ios-series-review-item {
          display: flex;
          align-items: center;
          gap: 14px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 14px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .ios-series-review-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .ios-series-review-item:active {
          background: rgba(255, 255, 255, 0.08);
          transform: scale(0.99);
        }
        .ios-series-review-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(56, 139, 253, 0.15);
          color: #58a6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .ios-series-review-svg {
          width: 22px;
          height: 22px;
        }
        .ios-series-review-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .ios-series-review-title {
          font-size: 15.5px;
          font-weight: 700;
          color: #f0f6fc;
          line-height: 1.25;
        }
        .ios-series-review-desc {
          font-size: 12.5px;
          font-weight: 400;
          color: #8b949e;
          line-height: 1.2;
        }
        .ios-series-palette {
          position: fixed;
          z-index: 70;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        .ios-series-palette-backdrop {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(0, 0, 0, 0.64);
        }
        .ios-series-palette-panel {
          position: relative;
          width: min(430px, 100%);
          max-height: 75svh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          padding: 0;
          border: 1px solid var(--dark-border);
          border-bottom: 0;
          border-radius: 24px 24px 0 0;
          background: var(--dark-surface);
          box-shadow: 0 -16px 44px rgba(0, 0, 0, 0.45);
        }
        .ios-series-palette-title {
          position: relative;
          flex: none;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--dark-border);
          color: var(--dark-text);
          font-size: 16px;
          font-weight: 700;
          background: var(--dark-surface);
          z-index: 10;
        }
        .ios-series-palette-title span {
          text-align: center;
          font-size: 16px;
          font-weight: 700;
        }
        .ios-series-palette-title button {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          display: grid;
          place-items: center;
          width: 32px;
          height: 32px;
          padding: 0;
          border: 1px solid var(--dark-border);
          border-radius: 50%;
          background: var(--dark-surface-muted);
          color: var(--dark-text);
          cursor: pointer;
        }
        .ios-series-palette-title svg {
          width: 16px;
          height: 16px;
        }
        .ios-series-palette-grid {
          flex: 1;
          overflow-y: auto;
          padding: 18px 20px calc(env(safe-area-inset-bottom) + 24px);
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          align-content: flex-start;
          gap: 10px;
        }
        .ios-series-palette-grid button {
          height: 42px;
          border: 1px solid var(--dark-border);
          border-radius: 10px;
          background: var(--dark-surface-muted);
          color: var(--dark-text-secondary);
          font: inherit;
          font-weight: 600;
          transition: all 0.15s ease;
        }
        .ios-series-palette-grid button.is-current {
          border-color: transparent;
          background: var(--dark-action);
          color: #fff;
          box-shadow: 0 2px 8px rgba(61, 106, 158, 0.4);
        }
        .ios-series-palette-grid button.is-correct,
        .ios-series-palette-grid button.is-answered {
          border-color: rgba(40, 117, 66, 0.6);
          background: rgba(40, 117, 66, 0.18);
          color: #4ade80;
        }
        .ios-series-palette-grid button.is-wrong {
          border-color: rgba(163, 59, 54, 0.6);
          background: rgba(163, 59, 54, 0.18);
          color: #f87171;
        }
        .ios-series-palette-grid button.is-unsubmitted {
          border-color: rgba(255, 159, 10, 0.5);
          background: rgba(255, 159, 10, 0.15);
          color: #fbbf24;
        }
        @media (min-width: 431px) {
          .ios-series-device {
            box-shadow: 0 0 0 1px var(--dark-border);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ios-series-option.is-user-answer,
          .ios-series-option.is-correct,
          .ios-series-option.is-user-answer.is-correct {
            animation: none;
          }
        }

        .ios-series-quiz .ios-series-meta-items {
          flex-wrap: wrap;
          column-gap: 6px;
          row-gap: 2px;
          overflow-wrap: anywhere;
        }
        .ios-series-quiz .ios-series-option-value,
        .ios-series-quiz .ios-series-prompt {
          overflow-wrap: anywhere;
        }
        .ios-series-quiz .ios-series-option:disabled {
          opacity: 1 !important;
        }
        .ios-series-quiz .ios-series-option.is-dimmed {
          opacity: 0.6 !important;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-question-card,
        .ios-series-quiz[data-theme="dark"] .ios-series-option {
          border-color: var(--dark-border);
          color: var(--dark-text);
        }
        .ios-series-quiz .ios-series-icon-button {
          flex-shrink: 0;
        }
        .ios-series-quiz .ios-series-exam-popover {
          left: auto;
          right: 0;
          transform: none;
        }

        /* Reading Comfort: Text Size Variations */
        .ios-series-quiz[data-text-size="sm"] .ios-series-prompt {
          font-size: 17px;
          font-weight: 400;
          line-height: 1.58;
        }
        .ios-series-quiz[data-text-size="sm"] .ios-series-prompt p + p {
          font-size: 17px;
          font-weight: 400;
          line-height: 1.58;
        }
        .ios-series-quiz[data-text-size="sm"] .ios-series-option-value {
          font-size: 15.5px;
          font-weight: 450;
          line-height: 1.48;
        }
        .ios-series-quiz[data-text-size="md"] .ios-series-prompt {
          font-size: 19.5px;
          font-weight: 400;
          line-height: 1.62;
        }
        .ios-series-quiz[data-text-size="md"] .ios-series-prompt p + p {
          font-size: 19.5px;
          font-weight: 400;
          line-height: 1.62;
        }
        .ios-series-quiz[data-text-size="md"] .ios-series-option-value {
          font-size: 17px;
          font-weight: 450;
          line-height: 1.55;
        }
        .ios-series-quiz[data-text-size="lg"] .ios-series-prompt {
          font-size: 21.5px;
          font-weight: 400;
          line-height: 1.66;
        }
        .ios-series-quiz[data-text-size="lg"] .ios-series-prompt p + p {
          font-size: 21.5px;
          font-weight: 400;
          line-height: 1.66;
        }
        .ios-series-quiz[data-text-size="lg"] .ios-series-option-value {
          font-size: 18.5px;
          font-weight: 450;
          line-height: 1.58;
        }

        /* Reading Comfort: Spacing Variations */
        .ios-series-quiz[data-spacing="compact"] .ios-series-options {
          gap: 8px;
          margin-top: 10px;
        }
        .ios-series-quiz[data-spacing="compact"] .ios-series-option {
          --ui-control-height: 48px;
          min-height: 48px;
          padding: 10px 14px;
          border-radius: 12px;
        }
        .ios-series-quiz[data-spacing="compact"] .ios-series-question-card {
          padding: 14px 16px;
        }
        .ios-series-quiz[data-spacing="compact"] .ios-series-actions {
          margin: 10px 0 14px;
          gap: 8px;
        }
        .ios-series-quiz[data-spacing="comfortable"] .ios-series-options {
          gap: 11px;
          margin-top: 16px;
        }
        .ios-series-quiz[data-spacing="comfortable"] .ios-series-option {
          --ui-control-height: 54px;
          min-height: 54px;
          padding: 13px 18px;
          border-radius: 15px;
        }
        .ios-series-quiz[data-spacing="comfortable"] .ios-series-question-card {
          padding: 20px 22px;
        }

        /* Light Theme Overrides (Palette: #F6F8FA White / #E6EAEF Ice Blue / #FFFFFF Pure White) */
        .ios-series-quiz[data-theme="light"] {
          --ios-accent: var(--light-accent);
          --ios-option-shadow: none;
          background: var(--light-canvas);
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-device {
          background: var(--light-canvas);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-header {
          background: var(--light-canvas);
        }
        .ios-series-quiz[data-theme="light"] .lang-toggle.lang-toggle {
          --lang-toggle-bg: #F0F2F5;
          --lang-toggle-border: #D8DEE4;
          --lang-toggle-active-bg: #FFFFFF;
          --lang-toggle-active-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
          --lang-toggle-divider: #D8DEE4;
          --lang-toggle-text: #57606A;
          --lang-toggle-text-active: #0969DA;
          --lang-toggle-text-hover: #24292F;
          background: var(--lang-toggle-bg);
          border-color: var(--lang-toggle-border);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-icon-button {
          border-color: var(--light-border);
          color: var(--light-text-secondary);
          background: #ffffff;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-icon-button.is-active {
          border-color: var(--light-accent);
          color: var(--light-accent);
          background: var(--light-accent-soft);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-num {
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-solution,
        .ios-series-quiz[data-theme="light"] .ios-series-ai-btn {
          border-color: #d8dee4;
          background: #ffffff;
          color: #424a53;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-solution:active,
        .ios-series-quiz[data-theme="light"] .ios-series-ai-btn:active {
          border-color: #c8d0d9;
          background: #f1f4f7;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-rail {
          background: var(--light-canvas);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question {
          border-color: #e2e8f0;
          background: #ffffff;
          color: #64748b;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-current {
          color: #ffffff !important;
          background: #2563eb !important;
          border-color: #2563eb !important;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4) !important;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-correct,
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-answered {
          border-color: #e2e8f0;
          background: #ffffff;
          color: #64748b;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-correct::after,
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-answered::after {
          background: #16a34a;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-wrong {
          border-color: #e2e8f0;
          background: #ffffff;
          color: #64748b;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-wrong::after {
          background: #dc2626;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-unsubmitted {
          border-color: #e2e8f0;
          background: #ffffff;
          color: #64748b;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-unsubmitted::after {
          background: #9333ea;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-meta-row {
          color: var(--light-text-secondary);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-meta-separator {
          color: rgba(87, 96, 106, 0.42);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-exam-details summary {
          color: #424a53;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-exam-details[open]
          summary {
          color: var(--light-text);
          background: var(--light-border);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-exam-popover {
          border-color: #d8dee4;
          color: var(--light-text);
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question-card {
          border-color: rgba(0, 0, 0, 0.055);
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 1px 2px rgba(0, 0, 0, 0.02);
          border-radius: 16px;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-timer {
          border-color: #e2e8f0;
          background: #f1f5f9;
          color: #334155;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-timer svg {
          color: #64748b;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-bookmark {
          color: var(--light-text-secondary);
          background: transparent;
          box-shadow: none;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-bookmark:active {
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-prompt {
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option:disabled {
          opacity: 1 !important;
          cursor: default;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option.is-dimmed {
          opacity: 0.6 !important;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option {
          border-color: rgba(0, 0, 0, 0.055);
          background: #ffffff;
          color: var(--light-text);
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option-value {
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option:not(:disabled):hover {
          border-color: rgba(37, 99, 235, 0.35);
          background: #f8fafc;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option-letter {
          border-color: transparent;
          background: #f1f5f9;
          color: #0f172a;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option.is-selected {
          border-color: #2563eb;
          background: #eff6ff;
          box-shadow: 0 0 0 1px #2563eb;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-selected
          .ios-series-option-letter {
          color: #ffffff;
          background: #2563eb;
          border-color: transparent;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option-radio {
          border-color: #cbd5e1;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option-radio.is-selected {
          border-color: #2563eb;
          background: #2563eb;
          box-shadow: inset 0 0 0 3px #ffffff;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option.is-correct {
          border-color: var(--light-border);
          background: #ffffff;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-correct
          .ios-series-option-letter {
          color: #ffffff;
          background: #16a34a;
          border-color: transparent;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option.is-wrong {
          border-color: var(--light-border);
          background: #ffffff;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-user-answer.is-correct {
          border-color: rgba(22, 163, 74, 0.34);
          box-shadow:
            0 0 0 1px rgba(22, 163, 74, 0.08),
            0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-user-answer.is-wrong {
          border-color: rgba(220, 38, 38, 0.36);
          box-shadow:
            0 0 0 1px rgba(220, 38, 38, 0.08),
            0 3px 12px rgba(15, 23, 42, 0.07);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-your-answer {
          color: #6e7781;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-wrong
          .ios-series-option-letter {
          color: #ffffff;
          background: #dc2626;
          border-color: transparent;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer {
          border-top-color: #e2e8f0;
          background: #ffffff;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer-prev,
        .ios-series-quiz[data-theme="light"] .ios-series-footer-secondary {
          border-color: #e2e8f0;
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer-review {
          border-color: rgba(37, 99, 235, 0.14);
          background: #eef4ff;
          color: #2563eb;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer-review.is-active {
          background: #dbeafe;
          border-color: #93c5fd;
          color: #1d4ed8;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer-next,
        .ios-series-quiz[data-theme="light"] .ios-series-footer-primary {
          background: #2563eb;
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 16px -4px rgba(37, 99, 235, 0.5);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer button:disabled {
          background: #f1f5f9 !important;
          border: 1px solid #e2e8f0 !important;
          color: #94a3b8 !important;
          box-shadow: none !important;
          cursor: not-allowed !important;
          opacity: 1 !important;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer button:disabled svg {
          color: #94a3b8 !important;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-review-backdrop {
          background: rgba(0, 0, 0, 0.22);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-review-panel {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 -6px 30px rgba(0, 0, 0, 0.12), 0 4px 14px rgba(0, 0, 0, 0.06);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-review-handle {
          background: #cbd5e1;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-review-item:hover {
          background: #f8fafc;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-review-item:active {
          background: #f1f5f9;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-review-icon {
          background: #eff6ff;
          color: #2563eb;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-review-title {
          color: #0f172a;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-review-desc {
          color: #64748b;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-backdrop {
          background: rgba(0, 0, 0, 0.4);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-panel {
          border-color: var(--light-border);
          background: var(--light-canvas);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-title {
          color: var(--light-text);
          border-bottom-color: var(--light-border);
          background: var(--light-canvas);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-title button {
          border-color: var(--light-border);
          background: #ffffff;
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-palette-grid button {
          border-color: var(--light-border);
          background: #ffffff;
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-current {
          color: #ffffff;
          background: var(--light-accent);
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-correct,
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-answered {
          border-color: #a5d6a7;
          background: #e8f5e9;
          color: #2e7d32;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-wrong {
          border-color: #ef9a9a;
          background: #ffebee;
          color: #c62828;
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-palette-grid
          button.is-unsubmitted {
          border-color: #ffe082;
          background: #fff8e1;
          color: #f57f17;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-icon-button {
          width: 34px;
          height: 34px;
          min-width: 34px;
          min-height: 34px;
        }
      `;
