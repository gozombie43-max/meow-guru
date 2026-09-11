import css from "styled-jsx/css";

export const mobileQuizViewStyles = css.global`
        /* Softened Dark Exam Palette for Long Practice Sessions */
        .ios-series-quiz[data-theme="dark"] {
          --dark-canvas: #0D0F12;
          --dark-surface: #13161A;
          --dark-surface-muted: #181C21;
          --dark-border: #292E35;
          --dark-text: #E7E9EC;
          --dark-text-secondary: #989EA7;
          --dark-text-muted: #747B85;
          --dark-accent: #7296C4;
          --dark-accent-soft: #17263A;
          --dark-action: #3D6A9E;
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
          border-color: var(--dark-accent);
          background: var(--dark-accent-soft);
          color: var(--dark-text);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option:not(:disabled):hover {
          border-color: rgba(114, 150, 196, 0.4);
          background: var(--dark-surface-muted);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-selected {
          border-color: var(--dark-accent);
          background: var(--dark-accent-soft);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-selected .ios-series-option-letter,
        .ios-series-quiz[data-theme="dark"] .ios-series-palette-grid button.is-current {
          background: var(--dark-action);
          color: #ffffff;
          box-shadow: none;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-correct .ios-series-option-letter {
          background: #287542;
          color: #ffffff;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-wrong .ios-series-option-letter {
          background: #a33b36;
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
            "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
            "Noto Sans", "Helvetica Neue", Arial, sans-serif;
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
        .ios-series-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: calc(var(--safe-top) + 4px) max(12px, var(--safe-right)) 4px max(12px, var(--safe-left));
          flex: none;
          border-bottom: 1px solid var(--dark-border);
        }
        .ios-series-icon-button {
          min-width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          border: 1px solid var(--dark-border);
          border-radius: 10px;
          color: var(--dark-text);
          background: var(--dark-surface);
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
          box-sizing: border-box;
        }
        .ios-series-icon-button.is-active {
          border-color: var(--dark-accent);
          background: var(--dark-accent-soft);
          color: var(--dark-accent);
        }
        .ios-series-icon-button.is-qnum {
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum";
        }
        .ios-series-icon-button.is-qnum-sm {
          min-width: 44px;
          padding: 0 5px;
          font-size: 14px;
          letter-spacing: -0.01em;
        }
        .ios-series-icon-button.is-qnum-md {
          min-width: 44px;
          padding: 0 6px;
          font-size: 12.5px;
          letter-spacing: -0.02em;
        }
        .ios-series-icon-button.is-qnum-lg {
          min-width: 46px;
          padding: 0 7px;
          font-size: 11px;
          letter-spacing: -0.03em;
        }
        .ios-series-palette-num {
          display: inline-block;
          line-height: 1;
          font-weight: 700;
          text-align: center;
        }
        .ios-series-icon-button svg {
          width: 20px;
          height: 20px;
        }
        .ios-series-quiz .lang-toggle {
          flex: 0 1 auto;
          min-width: 0;
          height: 44px !important;
          padding: 0;
          border-radius: 12px;
          box-shadow: none;
        }
        .ios-series-quiz .lang-toggle > div {
          height: 44px !important;
        }
        .ios-series-quiz[data-theme="dark"] .lang-toggle.lang-toggle {
          --lang-toggle-bg: #13161A;
          --lang-toggle-border: #292E35;
          --lang-toggle-active-bg: #17263A;
          --lang-toggle-active-shadow: none;
          --lang-toggle-divider: #292E35;
          --lang-toggle-text: var(--dark-text-secondary);
          --lang-toggle-text-active: var(--dark-text);
          --lang-toggle-text-hover: var(--dark-text);
          background: var(--lang-toggle-bg);
          border-color: var(--lang-toggle-border);
        }
        .ios-series-quiz .lang-toggle-option {
          min-width: 0;
          height: 44px;
          padding-inline: 8px;
          font-size: 11px;
        }
        .ios-series-rail {
          display: flex;
          gap: 6px;
          flex: none;
          align-items: center;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          padding: 6px max(12px, var(--safe-right)) 6px max(12px, var(--safe-left));
          border-bottom: 1px solid var(--dark-border);
          scrollbar-width: none;
        }
        .ios-series-rail::-webkit-scrollbar {
          display: none;
        }
        .ios-series-question {
          position: relative;
          flex: 0 0 44px;
          width: 44px;
          height: 44px;
          padding: 0;
          border: 1px solid var(--dark-border);
          border-radius: 10px;
          background: var(--dark-surface);
          color: var(--dark-text-muted);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          transition:
            background 140ms ease,
            color 140ms ease,
            border-color 140ms ease;
        }
        .ios-series-question::after {
          position: absolute;
          top: 2px;
          right: 4px;
          color: var(--dark-text-muted);
          font-size: 8px;
          font-weight: 800;
          line-height: 1;
        }
        .ios-series-question.is-current {
          border-color: var(--dark-accent);
          background: var(--dark-accent-soft);
          color: var(--dark-text);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }
        .ios-series-question.is-correct,
        .ios-series-question.is-answered {
          border-color: #292E35;
          background: var(--dark-surface-muted);
          color: var(--dark-text);
        }
        .ios-series-question.is-correct::after,
        .ios-series-question.is-answered::after {
          content: "✓";
        }
        .ios-series-question.is-wrong {
          border-color: #292E35;
          background: var(--dark-surface-muted);
          color: var(--dark-text);
        }
        .ios-series-question.is-wrong::after {
          content: "×";
        }
        .ios-series-question.is-unsubmitted {
          border-color: #292E35;
          background: var(--dark-surface-muted);
          color: var(--dark-text);
        }
        .ios-series-content {
          flex: 1;
          min-height: 0;
          min-width: 0;
          overflow-y: auto;
          padding: 4px max(16px, var(--safe-right)) 16px max(16px, var(--safe-left));
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
          font-size: 13px;
          font-weight: 500;
          line-height: 1.35;
        }
        .ios-series-meta-items {
          display: flex;
          align-items: center;
          gap: 7px;
          min-width: 0;
          flex: 1;
        }
        .ios-series-meta-separator {
          flex: none;
          color: var(--dark-text-muted);
        }
        .ios-series-exam-label {
          min-width: 0;
          line-height: 1.35;
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
          font-size: 12px;
          font-weight: 500;
          line-height: 1.4;
          transform: translateX(-50%);
        }
        .ios-series-quiz .concept-badge {
          flex: none;
          letter-spacing: 0;
        }
        .ios-series-question-card {
          position: relative;
          padding: 14px 16px;
          border: 1px solid var(--dark-border);
          border-radius: 14px;
          background: var(--dark-surface);
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
          font-size: 19px;
          font-weight: 500;
          line-height: 1.58;
          letter-spacing: -0.005em;
        }
        .ios-series-prompt p {
          margin: 0;
        }
        .ios-series-prompt p + p {
          margin-top: 12px;
          font-family: inherit;
          font-size: 19px;
          font-weight: 500;
          line-height: 1.58;
          letter-spacing: normal;
        }
        .ios-series-quiz .ios-series-prompt .quote-highlight {
          font-weight: 500;
        }
        .ios-series-options {
          display: grid;
          gap: 10px;
          margin-top: 12px;
        }
        .ios-series-option {
          --ui-control-height: 52px;
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border: 1px solid var(--dark-border);
          border-radius: 14px;
          background: var(--dark-surface);
          color: var(--dark-text);
          box-shadow: var(--ios-option-shadow);
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
          border-color: rgba(114, 150, 196, 0.4);
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
          border-color: var(--dark-accent);
          background: var(--dark-accent-soft);
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
            0 0 0 1px rgba(40, 117, 66, 0.2),
            var(--ios-option-shadow);
        }
        .ios-series-option.is-user-answer.is-wrong {
          border-color: rgba(163, 59, 54, 0.5);
          box-shadow:
            0 0 0 1px rgba(163, 59, 54, 0.2),
            var(--ios-option-shadow);
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
            box-shadow: var(--ios-option-shadow);
          }
          45% {
            box-shadow:
              0 0 0 3px rgba(40, 117, 66, 0.25),
              0 0 16px rgba(40, 117, 66, 0.2),
              var(--ios-option-shadow);
          }
          100% {
            box-shadow:
              0 0 0 1px rgba(40, 117, 66, 0.15),
              var(--ios-option-shadow);
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
          background: var(--dark-surface-muted);
          color: var(--dark-text-muted);
          font-size: 15px;
          font-weight: 600;
          line-height: 1;
        }
        .ios-series-option.is-selected .ios-series-option-letter {
          border-color: transparent;
          background: var(--dark-action);
          color: #fff;
        }
        .ios-series-option.is-correct .ios-series-option-letter {
          border-color: transparent;
          background: #287542;
          color: #ffffff;
        }
        .ios-series-option.is-wrong .ios-series-option-letter {
          border-color: transparent;
          background: #a33b36;
          color: #ffffff;
        }
        .ios-series-option-value {
          min-width: 0;
          color: #DDE0E4;
          font-size: 18px;
          font-weight: 400;
          line-height: 1.45;
          letter-spacing: -0.003em;
        }
        .ios-series-option-status {
          display: inline-flex;
          align-items: center;
          margin-left: auto;
          flex: none;
          width: 20px;
          justify-content: flex-end;
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
          color: #287542;
        }
        .ios-series-option.is-wrong .ios-series-answer-icon {
          color: #a33b36;
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
          z-index: 30;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          width: 100%;
          max-width: 768px;
          margin: 0 auto;
          padding: 10px max(16px, var(--safe-right)) calc(var(--safe-bottom) + 10px) max(16px, var(--safe-left));
          border-top: 1px solid var(--dark-border);
          background: linear-gradient(
            180deg,
            rgba(13, 15, 18, 0),
            rgba(13, 15, 18, 0.96) 25%,
            var(--dark-canvas)
          );
          flex-shrink: 0;
        }
        .ios-series-footer button {
          --ui-control-height: 52px;
          min-width: 0;
          height: 52px;
          border-radius: 14px;
          font: inherit;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        .ios-series-footer button:disabled {
          opacity: 0.38;
          cursor: not-allowed;
        }
        .ios-series-footer-secondary {
          border: 1px solid var(--dark-border);
          background: var(--dark-surface);
          color: var(--dark-text);
        }
        .ios-series-footer-primary {
          border: 0;
          background: var(--dark-action);
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
        }
        .ios-series-footer-primary:not(:disabled):active {
          transform: scale(0.98);
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
          line-height: 1.52;
        }
        .ios-series-quiz[data-text-size="sm"] .ios-series-prompt p + p {
          font-size: 17px;
          line-height: 1.52;
        }
        .ios-series-quiz[data-text-size="sm"] .ios-series-option-value {
          font-size: 16px;
          line-height: 1.42;
        }
        .ios-series-quiz[data-text-size="md"] .ios-series-prompt {
          font-size: 19px;
          line-height: 1.58;
        }
        .ios-series-quiz[data-text-size="md"] .ios-series-prompt p + p {
          font-size: 19px;
          line-height: 1.58;
        }
        .ios-series-quiz[data-text-size="md"] .ios-series-option-value {
          font-size: 18px;
          line-height: 1.45;
        }
        .ios-series-quiz[data-text-size="lg"] .ios-series-prompt {
          font-size: 21px;
          line-height: 1.62;
        }
        .ios-series-quiz[data-text-size="lg"] .ios-series-prompt p + p {
          font-size: 21px;
          line-height: 1.62;
        }
        .ios-series-quiz[data-text-size="lg"] .ios-series-option-value {
          font-size: 20px;
          line-height: 1.48;
        }

        /* Reading Comfort: Spacing Variations */
        .ios-series-quiz[data-spacing="compact"] .ios-series-options {
          gap: 8px;
          margin-top: 10px;
        }
        .ios-series-quiz[data-spacing="compact"] .ios-series-option {
          --ui-control-height: 46px;
          min-height: 46px;
          padding: 8px 12px;
          border-radius: 12px;
        }
        .ios-series-quiz[data-spacing="compact"] .ios-series-question-card {
          padding: 12px 14px;
        }
        .ios-series-quiz[data-spacing="compact"] .ios-series-actions {
          margin: 10px 0 14px;
          gap: 8px;
        }
        .ios-series-quiz[data-spacing="comfortable"] .ios-series-options {
          gap: 10px;
          margin-top: 12px;
        }
        .ios-series-quiz[data-spacing="comfortable"] .ios-series-option {
          --ui-control-height: 52px;
          min-height: 52px;
          padding: 10px 14px;
          border-radius: 14px;
        }
        .ios-series-quiz[data-spacing="comfortable"] .ios-series-question-card {
          padding: 14px 16px;
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
          border-color: var(--light-border);
          background: var(--light-canvas);
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
          border-color: var(--light-border);
          background: var(--light-canvas);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question {
          border-color: #e1e4e8;
          background: #ffffff;
          color: #9aa0a6;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question::after {
          color: #73777c;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-current {
          color: var(--light-text);
          background: #ffffff;
          border-color: #5f6368;
          box-shadow: inset 0 0 0 1px rgba(29, 29, 31, 0.06);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-correct,
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-answered {
          border-color: #d8dce0;
          background: #f3f4f5;
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question.is-wrong {
          border-color: #d8dce0;
          background: #f3f4f5;
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-question.is-unsubmitted {
          border-color: #d8dce0;
          background: #eef0f2;
          color: #30343a;
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
          border-color: var(--light-border);
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
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
          border-color: #d8dee4;
          background: #ffffff;
          color: var(--light-text);
          box-shadow: var(--ios-option-shadow);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option-value {
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option:not(:disabled):hover {
          border-color: rgba(0, 113, 227, 0.4);
          background: #ffffff;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option-letter {
          border-color: transparent;
          background: var(--light-border);
          color: var(--light-text);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option.is-selected {
          border-color: var(--light-accent);
          background: var(--light-accent-soft);
        }
        .ios-series-quiz[data-theme="light"]
          .ios-series-option.is-selected
          .ios-series-option-letter {
          color: #ffffff;
          background: var(--light-accent);
          border-color: transparent;
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
          border-top-color: #d8dee4;
          background: var(--light-surface);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer-secondary {
          border-color: var(--light-border);
          background: #ffffff;
          color: var(--light-text-secondary);
        }
        .ios-series-quiz[data-theme="light"] .ios-series-footer-primary {
          background: var(--ios-accent);
          color: #ffffff;
          border: none;
          box-shadow: 0 4px 16px -4px rgba(0, 113, 227, 0.5);
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
          min-height: 44px;
          min-width: 44px;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-question-card {
          box-shadow: none;
          border-radius: 14px;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option {
          border-radius: 14px;
          min-height: 52px;
        }
      `;
