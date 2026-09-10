import css from "styled-jsx/css";

export const resourcePageStyles = css.global`
        /* ════════════════════════════════════════════
           THEME TOKENS: DARK (DEFAULT)
           ════════════════════════════════════════════ */
        .resource-page {
          --bg: #000000;
          --card-bg: #1c1c1e;
          --card-hover: #242428;
          --border: rgba(255, 255, 255, 0.09);
          --header-bg: rgba(0, 0, 0, 0.92);
          --text-primary: #f8fafc;
          --text-secondary: rgba(235, 235, 245, 0.6);
          --text-tertiary: rgba(235, 235, 245, 0.35);
          --tab-bg: rgba(255, 255, 255, 0.08);
          --tab-color: rgba(235, 235, 245, 0.75);
          --accent: #007aff;
          --modal-bg: #1c1c1e;
          --modal-option-bg: #28282c;
          --notice-bg: rgba(255, 255, 255, 0.08);
          --spinner-color: rgba(235, 235, 245, 0.75);

          height: 100dvh;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
          position: relative;
        }

        /* ── Fixed Position Top Area ── */
        .res-top-pinned {
          flex-shrink: 0;
          z-index: 30;
          background: var(--header-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
          padding-top: var(--safe-top);
        }

        .res-nav-bar {
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          max-width: 600px;
          margin: 0 auto;
        }

        .res-nav-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: var(--text-primary);
          cursor: pointer;
          transition: background-color 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          text-decoration: none;
        }

        .res-nav-btn:hover {
          background: var(--tab-bg);
        }

        .res-nav-btn:active {
          opacity: 0.6;
          transform: scale(0.95);
        }

        .res-nav-btn.active {
          background: var(--accent);
          color: #ffffff;
        }

        .res-nav-title {
          font-size: 17px;
          font-weight: 650;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          margin: 0;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          padding: 0 8px;
        }

        .res-nav-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        /* ── Search Bar Dropdown ── */
        .res-search-container {
          padding: 0 12px 6px;
          max-width: 600px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          animation: res-slide-down 0.2s ease;
        }

        @keyframes res-slide-down {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .res-search-input-wrap {
          position: relative;
          width: 100%;
          display: block;
        }

        .res-search-input {
          width: 100%;
          height: 34px;
          border-radius: 9px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--text-primary);
          font-size: 13.5px;
          padding: 0 32px 0 32px;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.15s ease;
          font-family: inherit;
        }

        .res-search-input:focus {
          border-color: var(--accent);
        }

        :global(.res-search-field-icon) {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-tertiary);
          pointer-events: none;
        }

        .res-search-clear-btn {
          position: absolute;
          right: 9px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--tab-bg);
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
        }

        /* ── Unified Filter Architecture ── */
        .res-filter-container {
          max-width: 600px;
          margin: 0 auto;
          padding: 0 12px 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        /* Level 1: Primary Subject Segmented Control (iOS UISegmentedControl) */
        .res-subject-segment {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: var(--segment-track, rgba(120, 120, 128, 0.18));
          border-radius: 9px;
          padding: 2.5px;
          box-sizing: border-box;
          height: 33px;
          align-items: center;
        }

        .res-segment-btn {
          height: 28px;
          border: none;
          border-radius: 7px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 12.5px;
          font-weight: 550;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          -webkit-tap-highlight-color: transparent;
          white-space: nowrap;
          padding: 0 4px;
          font-family: inherit;
        }

        .res-segment-btn:hover {
          color: var(--text-primary);
        }

        .res-segment-btn.active {
          background: var(--segment-active-bg, #3a3a3c);
          color: #ffffff;
          font-weight: 650;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3), 0 0 0 0.5px rgba(0, 0, 0, 0.12);
        }

        :global(.res-segment-icon) {
          color: currentColor;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .res-segment-btn.active :global(.res-segment-icon) {
          color: var(--subject-accent, var(--accent));
        }

        .res-segment-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Level 2: Secondary Category Chip Bar */
        .res-category-strip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          padding: 0 2px;
        }

        .res-category-strip::-webkit-scrollbar {
          display: none;
        }

        .res-chip {
          height: 25px;
          padding: 0 11px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--tab-color);
          font-size: 11.5px;
          font-weight: 550;
          letter-spacing: 0.01em;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.14s ease;
          -webkit-tap-highlight-color: transparent;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
        }

        .res-chip:hover {
          color: var(--text-primary);
          background: var(--card-hover);
        }

        .res-chip.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
          font-weight: 600;
          box-shadow: 0 1.5px 6px rgba(0, 122, 255, 0.35);
        }

        /* ── Scrollable Document List Area ── */
        .res-scroll-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
          scrollbar-width: thin;
        }

        .res-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          padding: 14px 14px calc(92px + var(--safe-bottom));
          box-sizing: border-box;
        }

        /* ── Notice Banner ── */
        .res-notice-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 12px;
          background: var(--notice-bg);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 13px;
          margin-bottom: 12px;
          animation: res-fade-up 0.2s ease;
        }

        .res-notice-close {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
        }

        /* ── Loading State ── */
        .res-loading-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(65dvh - 120px);
          gap: 14px;
          animation: res-fade-up 0.25s ease;
          margin: auto 0;
          text-align: center;
          width: 100%;
        }

        :global(.ios-spinner) {
          display: inline-block;
          color: var(--spinner-color);
          flex-shrink: 0;
        }

        .res-loading-text {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        /* ── Cards List ── */
        .res-card-list {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .res-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          min-height: 62px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--card-bg);
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
          text-decoration: none;
          outline: none;
          transition: background-color 0.12s ease, border-color 0.12s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          animation: res-fade-up 0.28s ease both;
        }

        @keyframes res-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (hover: hover) {
          .res-card:hover {
            background: var(--card-hover);
            border-color: rgba(255, 255, 255, 0.16);
          }
        }

        .res-card:active {
          background: var(--card-hover);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .res-card-icon-wrap {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .res-card-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .res-card-title {
          font-size: 14.5px;
          font-weight: 600;
          line-height: 1.3;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .res-card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .res-card-tag {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--tab-bg);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .res-card-date {
          font-size: 11.5px;
          color: var(--text-secondary);
        }

        .res-card-arrow {
          color: var(--text-tertiary);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          transition: color 0.15s ease;
        }

        @media (hover: hover) {
          .res-card:hover .res-card-arrow {
            color: var(--text-primary);
          }
        }

        /* ── Empty State ── */
        .res-empty-state {
          text-align: center;
          padding: 56px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          animation: res-fade-up 0.28s ease;
        }

        .res-empty-icon {
          color: var(--text-tertiary);
          margin-bottom: 2px;
        }

        .res-empty-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0;
        }

        .res-empty-sub {
          font-size: 13px;
          color: var(--text-secondary);
          margin: 0;
          max-width: 280px;
          line-height: 1.4;
        }

        .res-empty-btn {
          margin-top: 14px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 999px;
          background: var(--accent);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0, 122, 255, 0.35);
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .res-empty-btn:active {
          transform: scale(0.96);
          opacity: 0.85;
        }

        /* ── Floating Action Button (FAB) ── */
        .res-fab {
          position: fixed;
          bottom: calc(24px + var(--safe-bottom));
          right: max(20px, env(safe-area-inset-right));
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          color: #ffffff;
          box-shadow: 0 4px 18px rgba(0, 122, 255, 0.44), 0 2px 6px rgba(0, 122, 255, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 35;
          transition: transform 0.16s ease, box-shadow 0.16s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .res-fab:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 22px rgba(0, 122, 255, 0.55);
        }

        .res-fab:active {
          transform: scale(0.92);
        }

        .res-fab:disabled {
          opacity: 0.6;
          cursor: wait;
        }

        .res-file-input {
          display: none;
        }

        /* ── Upload Modal ── */
        .res-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 16px;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: res-fade-in 0.18s ease;
        }

        @keyframes res-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .res-modal {
          width: min(100%, 420px);
          border-radius: 20px;
          border: 1px solid var(--border);
          background: var(--modal-bg);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
          padding: 20px;
          margin-bottom: var(--safe-bottom);
          animation: res-modal-up 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes res-modal-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .res-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .res-modal-eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-tertiary);
        }

        .res-modal-title {
          margin: 2px 0 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .res-modal-close {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--tab-bg);
          border: none;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .res-modal-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          max-height: 52dvh;
          overflow-y: auto;
          scrollbar-width: thin;
          padding: 1px;
        }

        .res-modal-option {
          min-height: 48px;
          border-radius: 12px;
          border: 1px solid var(--border);
          color: var(--text-primary);
          background: var(--modal-option-bg);
          font-size: 12.5px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          text-align: left;
          transition: background 0.15s ease, border-color 0.15s ease;
          font-family: inherit;
        }

        .res-modal-option:hover {
          background: var(--card-hover);
        }

        .res-modal-option.current {
          border-color: var(--subject-accent, var(--accent));
          box-shadow: inset 0 0 0 1px var(--subject-accent, var(--accent));
        }

        .res-modal-option-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--subject-accent, var(--accent));
          flex-shrink: 0;
        }

        .res-modal-option-label strong {
          color: var(--text-primary);
          font-weight: 650;
        }

        .res-modal-cancel {
          width: 100%;
          min-height: 44px;
          margin-top: 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          background: transparent;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .res-modal-cancel:hover {
          background: var(--tab-bg);
        }

        /* ════════════════════════════════════════════
           LIGHT THEME OVERRIDES
           ════════════════════════════════════════════ */
        :global(body.theme-light) .resource-page,
        :global(html.theme-light) .resource-page {
          --bg: #f6f8fa;
          --card-bg: #ffffff;
          --card-hover: #f8fafc;
          --border: rgba(0, 0, 0, 0.08);
          --header-bg: rgba(246, 248, 250, 0.92);
          --text-primary: #1d1d1f;
          --text-secondary: #57606a;
          --text-tertiary: #8c959f;
          --tab-bg: rgba(0, 0, 0, 0.05);
          --tab-color: #57606a;
          --modal-bg: #ffffff;
          --modal-option-bg: #f2f2f7;
          --notice-bg: rgba(0, 0, 0, 0.04);
          --spinner-color: rgba(60, 60, 67, 0.6);
          --segment-track: rgba(118, 118, 128, 0.12);
          --segment-active-bg: #ffffff;
        }

        :global(body.theme-light) .res-segment-btn.active,
        :global(html.theme-light) .res-segment-btn.active {
          color: #000000;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.12), 0 0 0 0.5px rgba(0, 0, 0, 0.04);
        }

        :global(body.theme-light) .res-card {
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.02);
        }

        @media (hover: hover) {
          :global(body.theme-light) .res-card:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            background: #f8fafc;
            border-color: rgba(0, 0, 0, 0.14);
          }
        }

        :global(body.theme-light) .res-card:active {
          background: #ebeef2;
          border-color: rgba(0, 0, 0, 0.16);
        }
      `;
