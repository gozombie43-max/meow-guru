import css from "styled-jsx/css";

export const mobileQuizViewStyles = css.global`
        /* Pure black exam surfaces with a restrained iOS blue accent. */
        .ios-series-quiz[data-theme="dark"] {
          --dark-canvas: #000000;
          --dark-surface: #000000;
          --dark-surface-muted: #141414;
          --dark-border: #292929;
          --dark-text: #e6e6e6;
          --dark-text-secondary: #c2c2c2;
          --dark-text-muted: #a3a3a3;
          --dark-accent: #719cce;
          --dark-accent-soft: #101d2d;
          --dark-action: #356da8;
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
          color: var(--dark-text-muted);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-icon-button.is-active {
          border-color: var(--dark-accent);
          background: var(--dark-accent-soft);
          color: var(--dark-text);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option:not(:disabled):hover {
          border-color: var(--dark-accent);
          background: var(--dark-surface-muted);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-selected .ios-series-option-letter,
        .ios-series-quiz[data-theme="dark"] .ios-series-palette-grid button.is-current {
          background: var(--dark-action);
          color: var(--dark-text);
          box-shadow: none;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-correct .ios-series-option-letter {
          background: #287542;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-wrong .ios-series-option-letter {
          background: #a33b36;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-exam-details summary:focus-visible {
          outline-color: var(--dark-accent);
        }
        .ios-series-quiz {
          --ios-accent: var(--dark-accent);
          --ios-option-shadow: none;
          min-height: 100dvh;
          background: var(--dark-canvas);
          color: var(--light-canvas);
          font-family:
            -apple-system, BlinkMacSystemFont, "SF Pro Text", "Roboto",
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
        }
        .ios-series-icon-button {
          min-width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          color: var(--light-canvas);
          background: var(--dark-surface);
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 14px;
          font-weight: 700;
          white-space: nowrap;
          box-sizing: border-box;
        }
        .ios-series-icon-button.is-active {
          border-color: #007aff;
          background: rgba(0, 122, 255, 0.22);
          color: #007aff;
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
        /* The quiz selection takes precedence over a surrounding light page. */
        .ios-series-quiz[data-theme="dark"] .lang-toggle.lang-toggle {
          --lang-toggle-bg: #000000;
          --lang-toggle-border: var(--dark-border);
          --lang-toggle-active-bg: #182637;
          --lang-toggle-active-shadow: none;
          --lang-toggle-divider: #292929;
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
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
          font-weight: 650;
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
          color: #8e8e93;
          font-size: 8px;
          font-weight: 800;
          line-height: 1;
        }
        .ios-series-question.is-current {
          border-color: var(--ios-accent);
          background: var(--dark-accent-soft);
          color: var(--light-canvas);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
        }
        .ios-series-question.is-correct,
        .ios-series-question.is-answered {
          border-color: #303034;
          background: var(--dark-surface-muted);
          color: var(--light-canvas);
        }
        .ios-series-question.is-correct::after,
        .ios-series-question.is-answered::after {
          content: "✓";
        }
        .ios-series-question.is-wrong {
          border-color: #303034;
          background: var(--dark-surface-muted);
          color: var(--light-canvas);
        }
        .ios-series-question.is-wrong::after {
          content: "×";
        }
        .ios-series-question.is-unsubmitted {
          border-color: #35353a;
          background: var(--dark-surface-muted);
          color: #e5e5ea;
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
          color: rgba(235, 235, 245, 0.58);
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
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
          color: rgba(235, 235, 245, 0.3);
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
          color: rgba(235, 235, 245, 0.72);
          line-height: 1.35;
          list-style: none;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .ios-series-exam-details summary::-webkit-details-marker {
          display: none;
        }
        .ios-series-exam-details summary:focus-visible {
          outline: 2px solid #007aff;
          outline-offset: 2px;
        }
        .ios-series-exam-details[open] summary {
          color: var(--light-canvas);
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
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          color: rgba(255, 255, 255, 0.88);
          background: var(--dark-surface-muted);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36);
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
          padding: 16px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 12px;
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
          color: rgba(235, 235, 245, 0.58);
          background: transparent;
          cursor: pointer;
          flex-shrink: 0;
          margin-left: auto;
          transition:
            color 0.16s ease,
            transform 0.16s ease;
        }
        .ios-series-bookmark:active {
          color: rgba(242, 242, 247, 0.9);
          transform: scale(0.92);
        }
        .ios-series-bookmark svg {
          width: 20px;
          height: 20px;
        }
        .ios-series-prompt {
          color: rgba(242, 242, 247, 0.94);
          font-size: 17px;
          font-weight: 500;
          line-height: 1.62;
          letter-spacing: 0.002em;
        }
        .ios-series-prompt p {
          margin: 0;
        }
        .ios-series-prompt p + p {
          margin-top: 14px;
          font-family: Georgia, serif;
          font-size: 22px;
          font-weight: 400;
          letter-spacing: 0.02em;
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
          --ui-control-height: 64px;
          width: 100%;
          min-height: 64px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 18px;
          background: var(--dark-surface);
          color: var(--light-canvas);
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
          border-color: rgba(0, 122, 255, 0.75);
          background: var(--dark-surface-muted);
        }
        .ios-series-option:not(:disabled):active {
          transform: scale(0.99);
        }
        .ios-series-option:disabled {
          cursor: default;
        }
        .ios-series-option.is-selected {
          border-color: #007aff;
          background: rgba(0, 122, 255, 0.15);
        }
        .ios-series-option.is-correct {
          border-color: rgba(255, 255, 255, 0.16);
          background: var(--dark-surface);
        }
        .ios-series-option.is-wrong {
          border-color: rgba(255, 255, 255, 0.16);
          background: var(--dark-surface);
        }
        .ios-series-option.is-user-answer.is-correct {
          border-color: rgba(48, 209, 88, 0.4);
          box-shadow:
            0 0 0 1px rgba(48, 209, 88, 0.12),
            var(--ios-option-shadow);
        }
        .ios-series-option.is-user-answer.is-wrong {
          border-color: rgba(255, 69, 58, 0.44);
          box-shadow:
            0 0 0 1px rgba(255, 69, 58, 0.12),
            var(--ios-option-shadow);
        }
        .ios-series-option.is-dimmed {
          opacity: 0.58;
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
            transform: scale(1.03);
          }
        }
        @keyframes ios-correct-glow {
          0% {
            box-shadow: var(--ios-option-shadow);
          }
          45% {
            box-shadow:
              0 0 0 3px rgba(48, 209, 88, 0.2),
              0 0 18px rgba(48, 209, 88, 0.18),
              var(--ios-option-shadow);
          }
          100% {
            box-shadow:
              0 0 0 1px rgba(48, 209, 88, 0.1),
              var(--ios-option-shadow);
          }
        }
        .ios-series-option-letter {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          box-sizing: border-box;
          display: grid;
          place-items: center;
          border: 1px solid transparent;
          border-radius: 11px;
          background: var(--dark-surface-muted);
          color: rgba(235, 235, 245, 0.68);
          font-size: 14px;
          font-weight: 700;
        }
        .ios-series-option.is-selected .ios-series-option-letter {
          border-color: transparent;
          background: #007aff;
          color: #fff;
        }
        .ios-series-option.is-correct .ios-series-option-letter {
          border-color: transparent;
          background: #30d158;
          color: #ffffff;
        }
        .ios-series-option.is-wrong .ios-series-option-letter {
          border-color: transparent;
          background: #ff453a;
          color: #ffffff;
        }
        .ios-series-option-value {
          min-width: 0;
          color: rgba(242, 242, 247, 0.92);
          font-size: 16px;
          font-weight: 500;
          line-height: 1.52;
          letter-spacing: 0.002em;
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
          /* Keep the selected-answer announcement without enlarging the row. */
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
          color: #30d158;
        }
        .ios-series-option.is-wrong .ios-series-answer-icon {
          color: #ff453a;
        }
        .ios-series-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin: 14px 0 18px;
        }
        .ios-series-actions.is-single-action {
          grid-template-columns: 1fr;
        }
        .ios-series-solution,
        .ios-series-ai-btn {
          width: 100%;
          min-width: 0;
          min-height: 46px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          background: var(--dark-surface);
          color: rgba(242, 242, 247, 0.82);
          font: inherit;
          font-size: 14px;
          font-weight: 700;
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
          border-color: rgba(255, 255, 255, 0.22);
          background: var(--dark-surface-muted);
          transform: scale(0.99);
        }
        .ios-series-error {
          margin: 12px 2px 0;
          color: #ff9f9a;
          font-size: 13px;
          font-weight: 600;
        }
        .ios-series-footer {
          z-index: 30;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          width: 100%;
          max-width: 768px;
          margin: 0 auto;
          padding: 12px max(16px, var(--safe-right)) calc(var(--safe-bottom) + 12px) max(16px, var(--safe-left));
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0),
            rgba(0, 0, 0, 0.94) 25%,
            var(--dark-canvas)
          );
          flex-shrink: 0;
        }
        .ios-series-footer button {
          --ui-control-height: 56px;
          min-width: 0;
          height: 56px;
          border-radius: 16px;
          font: inherit;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
        }
        .ios-series-footer button:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .ios-series-footer-secondary {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: var(--dark-surface);
          color: var(--light-canvas);
        }
        .ios-series-footer-primary {
          border: 0;
          background: var(--ios-accent);
          color: #fff;
          box-shadow: 0 4px 16px -4px rgba(0, 122, 255, 0.5);
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
          border: 1px solid rgba(255, 255, 255, 0.14);
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--light-canvas);
          font-size: 17px;
          font-weight: 700;
          background: var(--dark-surface);
          z-index: 10;
        }
        .ios-series-palette-title span {
          text-align: center;
          font-size: 17px;
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
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 50%;
          background: var(--dark-surface-muted);
          color: var(--light-canvas);
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
          gap: 12px;
        }
        .ios-series-palette-grid button {
          height: 43px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 12px;
          background: var(--dark-surface-muted);
          color: rgba(235, 235, 245, 0.7);
          font: inherit;
          font-weight: 700;
          transition: all 0.15s ease;
        }
        .ios-series-palette-grid button.is-current {
          border-color: transparent;
          background: #007aff;
          color: #fff;
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);
        }
        .ios-series-palette-grid button.is-correct,
        .ios-series-palette-grid button.is-answered {
          border-color: rgba(48, 209, 88, 0.6);
          background: rgba(48, 209, 88, 0.18);
          color: #30d158;
        }
        .ios-series-palette-grid button.is-wrong {
          border-color: rgba(255, 69, 58, 0.6);
          background: rgba(255, 69, 58, 0.18);
          color: #ff453a;
        }
        .ios-series-palette-grid button.is-unsubmitted {
          border-color: rgba(255, 159, 10, 0.6);
          background: rgba(255, 159, 10, 0.18);
          color: #ff9f0a;
        }
        @media (min-width: 431px) {
          .ios-series-device {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
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
          /* Submitted answers remain readable despite the shared disabled rule. */
          opacity: 1 !important;
        }
        .ios-series-quiz .ios-series-option.is-dimmed {
          opacity: 0.65 !important;
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-question-card,
        .ios-series-quiz[data-theme="dark"] .ios-series-option {
          border-color: var(--dark-border);
          color: var(--dark-text);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-selected {
          border-color: var(--dark-accent);
          background: var(--dark-accent-soft);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-correct {
          border-color: #30d158;
          background: var(--dark-surface);
        }
        .ios-series-quiz[data-theme="dark"] .ios-series-option.is-wrong {
          border-color: #ff453a;
          background: var(--dark-surface);
        }
        .ios-series-quiz .ios-series-icon-button {
          flex-shrink: 0;
        }
        .ios-series-quiz .ios-series-exam-popover {
          left: auto;
          right: 0;
          transform: none;
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
          border-radius: 12px;
        }
        .ios-series-quiz[data-theme="light"] .ios-series-option {
          border-radius: 10px;
          min-height: 44px;
        }
      `;
