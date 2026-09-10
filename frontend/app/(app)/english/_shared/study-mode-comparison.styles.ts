import css from "styled-jsx/css";

export const studyModeLoadingStyles = css`
          .apple-dict-viewport {
            min-height: 100dvh;
            background: var(--dark-canvas);
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
          }
          .apple-dict-viewport[data-theme="light"] {
            background: var(--light-canvas);
            color: var(--light-text);
          }
          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }
          .spinner {
            width: 38px;
            height: 38px;
            border: 3px solid rgba(0, 122, 255, 0.2);
            border-top-color: #007aff;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `;

export const studyModeComparisonStyles = css`
        /* ════════════════════════════════════════════════════
           AUTHENTIC APPLE DICTIONARY MATERIALS & SYSTEM COLOR TOKENS
           ════════════════════════════════════════════════════ */
        .apple-dict-viewport {
          --desktop-bg: var(--dark-canvas);
          --sidebar-bg: rgba(30, 30, 35, 0.85);
          --workspace-bg: var(--dark-canvas);
          --window-border: rgba(255, 255, 255, 0.16);
          --divider: rgba(255, 255, 255, 0.09);
          --text-primary: #ffffff;
          --text-secondary: #98989d;
          --text-muted: #636366;
          --item-hover: rgba(255, 255, 255, 0.06);
          --table-header: rgba(255, 255, 255, 0.03);
          --table-alt: rgba(255, 255, 255, 0.02);
          --quote-bg: rgba(255, 255, 255, 0.04);
          --quote-border: #007aff;
          --system-blue: #007aff;

          min-height: 100dvh;
          height: 100dvh;
          max-height: 100dvh;
          overflow: hidden;
          background: var(--desktop-bg);
          color: var(--text-primary);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Arial, sans-serif;
          display: flex;
          flex-direction: column;
          padding: 0;
        }

        .apple-dict-viewport[data-theme="light"] {
          --desktop-bg: var(--light-canvas);
          --sidebar-bg: rgba(235, 235, 240, 0.92);
          --workspace-bg: #ffffff;
          --window-border: rgba(0, 0, 0, 0.15);
          --divider: rgba(0, 0, 0, 0.08);
          --text-primary: var(--light-text);
          --text-secondary: #6e6e73;
          --text-muted: #86868b;
          --item-hover: rgba(0, 0, 0, 0.04);
          --table-header: rgba(0, 0, 0, 0.025);
          --table-alt: rgba(0, 0, 0, 0.015);
          --quote-bg: rgba(0, 0, 0, 0.03);
          --quote-border: #007aff;
          --system-blue: #007aff;
        }

        /* ── macOS Application Window Frame ── */
        .apple-app-window {
          width: 100vw;
          max-width: 100vw;
          height: 100dvh;
          max-height: 100dvh;
          background: var(--workspace-bg);
          border: none;
          box-shadow: none;
          border-radius: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          margin: 0;
        }

        .apple-dict-viewport[data-theme="light"] .apple-app-window {
          box-shadow: none;
        }

        /* ── Left Navigation Sidebar (Default hidden on Mobile) ── */
        .macos-sidebar {
          display: none;
        }

        /* ── Main Workspace Area ── */
        .macos-workspace {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Top Unified Toolbar */
        .unified-toolbar {
          height: calc(48px + var(--safe-top));
          border-bottom: 0.5px solid var(--divider);
          background: var(--sidebar-bg);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--safe-top) 10px 0;
          flex-shrink: 0;
          position: sticky;
          top: 0;
          z-index: 40;
          gap: 6px;
        }

        .toolbar-left, .toolbar-right {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .mobile-back-btn {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 30px;
          padding: 0 8px 0 6px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.07);
          color: var(--system-blue);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .apple-dict-viewport[data-theme="light"] .mobile-back-btn {
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: rgba(0, 0, 0, 0.05);
        }
        .mobile-back-btn:active {
          transform: scale(0.95);
          background: rgba(0, 122, 255, 0.14);
        }
        .mobile-back-text {
          line-height: 1;
        }

        .apple-segmented-control {
          display: none;
        }

        .mobile-toolbar-title {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 4px;
          max-width: 140px;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .mobile-toolbar-word {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .mobile-toolbar-pos {
          font-size: 11.5px;
          color: var(--text-secondary);
          font-style: italic;
        }

        .mobile-counter-filter-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: rgba(255, 255, 255, 0.07);
          color: var(--system-blue);
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          height: 28px;
          padding: 0 8px;
          border-radius: 7px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .apple-dict-viewport[data-theme="light"] .mobile-counter-filter-btn {
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: rgba(0, 0, 0, 0.05);
        }
        .mobile-counter-filter-btn:active {
          transform: scale(0.95);
          background: rgba(0, 122, 255, 0.14);
        }
        .counter-curr { font-weight: 700; }
        .counter-sep { opacity: 0.7; font-weight: 800; }
        .counter-tot { opacity: 0.85; font-weight: 600; }

        .appearance-toggle {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: var(--text-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .apple-dict-viewport[data-theme="light"] .appearance-toggle {
          border: 1px solid rgba(0, 0, 0, 0.15);
          background: rgba(0, 0, 0, 0.05);
        }
        .appearance-toggle:active {
          transform: scale(0.94);
        }

        .icon-theme { width: 14px; height: 14px; }

        /* ── Mobile Floating Navigation Buttons ── */
        .mobile-nav-footer {
          position: sticky;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px max(16px, env(safe-area-inset-bottom, 16px));
          background: linear-gradient(to top, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.6) 70%, transparent 100%);
          border: none;
          box-shadow: none;
          pointer-events: none;
          flex-shrink: 0;
        }

        .apple-dict-viewport[data-theme="light"] .mobile-nav-footer {
          background: linear-gradient(to top, rgba(229, 229, 235, 0.95) 0%, rgba(229, 229, 235, 0.65) 70%, transparent 100%);
        }

        .mobile-footer-btn {
          flex: 1;
          height: 52px;
          min-height: 52px;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          pointer-events: auto;
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
          transition: background 0.15s ease, transform 0.1s ease, border-color 0.15s ease, box-shadow 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          user-select: none;
        }

        .apple-dict-viewport[data-theme="light"] .mobile-footer-btn {
          border: 1px solid rgba(0, 0, 0, 0.16);
          background: rgba(0, 0, 0, 0.07);
          color: var(--light-text);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
        }

        .mobile-footer-btn:active:not(:disabled) {
          transform: scale(0.96);
          background: rgba(0, 122, 255, 0.25);
          border-color: rgba(0, 122, 255, 0.5);
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
        }

        .apple-dict-viewport[data-theme="light"] .mobile-footer-btn:active:not(:disabled) {
          background: rgba(0, 122, 255, 0.15);
          border-color: rgba(0, 122, 255, 0.4);
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.2);
        }

        .mobile-footer-btn:disabled {
          opacity: 0.35;
          border-color: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.35);
          background: rgba(255, 255, 255, 0.03);
          box-shadow: none;
          cursor: not-allowed;
          pointer-events: none;
        }

        .apple-dict-viewport[data-theme="light"] .mobile-footer-btn:disabled {
          border-color: rgba(0, 0, 0, 0.06);
          color: rgba(0, 0, 0, 0.3);
          background: rgba(0, 0, 0, 0.02);
        }

        /* Dictionary Body Content Area */
        .dictionary-body-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px calc(88px + max(16px, env(safe-area-inset-bottom, 16px)));
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* Centerpiece Word Profile */
        .dict-word-profile {
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-bottom: 0.5px solid var(--divider);
          padding-bottom: 20px;
        }

        .word-heading-line {
          display: flex;
          align-items: baseline;
          gap: 12px;
          flex-wrap: wrap;
        }

        .dict-main-word {
          font-size: clamp(2.2rem, 4vw, 3.2rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          margin: 0;
          color: var(--text-primary);
        }

        .grammar-tag {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-secondary);
          font-style: italic;
        }

        .meanings-container {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .dict-meaning-block {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .meaning-eng {
          font-size: 16px;
          line-height: 1.5;
          color: var(--text-primary);
        }

        .pos-inline { color: var(--system-blue); font-weight: 600; }

        .meaning-bng-quote {
          margin: 0;
          padding: 8px 14px;
          border-left: 3px solid var(--quote-border);
          background: var(--quote-bg);
          border-radius: 0 8px 8px 0;
          font-size: 15px;
          font-weight: 500;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .quote-icon { font-size: 14px; color: var(--system-blue); opacity: 0.8; }

        /* PC Apple Tables Grid (Hidden on Mobile) */
        .apple-tables-grid { display: none; }

        /* Mobile Touch Suite */
        .mobile-suite {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .mobile-seg-control {
          display: flex;
          border-bottom: 1px solid var(--divider);
          position: relative;
        }

        .m-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 12px 11px;
          border: none;
          background: transparent;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-secondary);
          cursor: pointer;
          position: relative;
          transition: color 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .m-tab.active {
          color: var(--text-primary);
          font-weight: 700;
        }

        .m-tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 12%;
          right: 12%;
          height: 3px;
          background: #007aff;
          border-radius: 3px 3px 0 0;
          box-shadow: 0 1px 6px rgba(0, 122, 255, 0.45);
        }

        .m-tab-badge {
          font-size: 11.5px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          background: var(--item-hover);
          color: var(--text-secondary);
          padding: 1px 7px;
          border-radius: 9999px;
          border: 0.5px solid var(--divider);
          transition: all 0.15s ease;
        }

        .m-tab.active .m-tab-badge {
          background: rgba(0, 122, 255, 0.14);
          color: #007aff;
          border-color: rgba(0, 122, 255, 0.3);
        }

        .ns-table-container {
          border: 1px solid var(--divider);
          border-radius: 14px;
          background: var(--item-hover);
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
        }

        .apple-dict-viewport[data-theme="light"] .ns-table-container {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        .table-body {
          display: flex;
          flex-direction: column;
        }

        .table-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 13px 16px;
          border-bottom: 0.5px solid var(--divider);
          font-size: 14.5px;
          transition: background 0.12s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-row:active {
          background: rgba(255, 255, 255, 0.08);
        }

        .apple-dict-viewport[data-theme="light"] .table-row:active {
          background: rgba(0, 0, 0, 0.06);
        }

        .cell-term {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .cell-trans {
          font-size: 14px;
          color: var(--text-secondary);
          text-align: right;
          max-width: 50%;
        }

        .table-empty {
          padding: 32px 20px;
          text-align: center;
          color: var(--text-muted);
          font-size: 14px;
        }

        /* Bottom Status Bar */
        .macos-status-bar {
          height: 44px;
          border-top: 0.5px solid var(--divider);
          background: var(--sidebar-bg);
          padding: 0 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-secondary);
        }

        .status-center { display: none; }
        .status-btn {
          padding: 6px 14px;
          border-radius: 6px;
          background: var(--item-hover);
          border: 0.5px solid var(--divider);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 600;
        }

        .status-btn:disabled { opacity: 0.4; }

        /* ── Full Page Mobile Filter Modal ── */
        .mobile-full-modal {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: var(--workspace-bg);
          display: flex;
          flex-direction: column;
          height: 100dvh;
          max-height: 100dvh;
          overflow: hidden;
          animation: modal-slide-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes modal-slide-in {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-top-bar {
          height: 48px;
          border-bottom: 0.5px solid var(--divider);
          background: var(--sidebar-bg);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          flex-shrink: 0;
        }

        .modal-top-back-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 32px;
          padding: 0 10px 0 6px;
          border-radius: 8px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          color: var(--system-blue);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .modal-top-back-btn:active {
          transform: scale(0.95);
          background: rgba(0, 122, 255, 0.14);
        }

        .modal-top-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .modal-top-reset-btn {
          height: 28px;
          padding: 0 10px;
          border-radius: 7px;
          border: none;
          background: rgba(255, 59, 48, 0.12);
          color: #ff3b30;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .modal-top-reset-btn:active {
          background: rgba(255, 59, 48, 0.22);
        }

        .modal-top-counter {
          font-size: 11.5px;
          font-weight: 600;
          color: var(--text-secondary);
          background: var(--item-hover);
          padding: 3px 8px;
          border-radius: 6px;
          border: 0.5px solid var(--divider);
        }

        .modal-search-wrapper {
          padding: 8px 12px 6px;
          flex-shrink: 0;
        }

        .modal-search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--item-hover);
          border: 0.5px solid var(--divider);
          border-radius: 9px;
          padding: 7px 10px;
        }

        .modal-search-ico {
          width: 14px;
          height: 14px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .modal-search-input {
          flex: 1;
          border: none;
          background: none;
          font-size: 14px;
          color: var(--text-primary);
          outline: none;
        }
        .modal-search-input::placeholder {
          color: var(--text-muted);
        }

        .modal-search-clear {
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
        }

        .modal-letter-strip {
          display: flex;
          gap: 5px;
          overflow-x: auto;
          padding: 4px 12px 8px;
          flex-shrink: 0;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        .modal-letter-strip::-webkit-scrollbar {
          display: none;
        }

        .modal-letter-chip {
          flex-shrink: 0;
          height: 28px;
          min-width: 30px;
          padding: 0 8px;
          border-radius: 7px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.12s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .modal-letter-chip:active {
          transform: scale(0.94);
        }
        .modal-letter-chip.active {
          background: var(--system-blue);
          color: #ffffff;
          border-color: var(--system-blue);
          box-shadow: 0 2px 8px rgba(0, 122, 255, 0.35);
        }

        .modal-status-bar {
          padding: 4px 12px 6px;
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 500;
          border-bottom: 0.5px solid var(--divider);
          flex-shrink: 0;
        }

        .modal-word-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 10px calc(24px + env(safe-area-inset-bottom, 16px));
          display: flex;
          flex-direction: column;
          gap: 5px;
          -webkit-overflow-scrolling: touch;
        }

        .modal-word-item {
          width: 100%;
          padding: 9px 11px;
          border-radius: 9px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: background 0.12s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
          text-align: left;
        }
        .modal-word-item:active {
          transform: scale(0.985);
          background: rgba(0, 122, 255, 0.1);
        }
        .modal-word-item.active {
          background: rgba(0, 122, 255, 0.12);
          border-color: rgba(0, 122, 255, 0.4);
        }

        .word-item-left {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }

        .word-item-idx {
          font-size: 10.5px;
          font-weight: 700;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
          padding-top: 2px;
          flex-shrink: 0;
          min-width: 24px;
        }

        .word-item-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex: 1;
          min-width: 0;
        }

        .word-name-row {
          display: flex;
          align-items: baseline;
          gap: 5px;
          flex-wrap: wrap;
        }

        .word-term {
          font-size: 14.5px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .modal-word-item.active .word-term {
          color: var(--system-blue);
        }

        .word-pos-tag {
          font-size: 11px;
          color: var(--text-secondary);
          font-style: italic;
        }

        .word-trans-preview {
          font-size: 12px;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .word-active-badge {
          font-size: 10px;
          font-weight: 700;
          background: var(--system-blue);
          color: #ffffff;
          padding: 2.5px 7px;
          border-radius: 9999px;
          flex-shrink: 0;
          margin-left: 6px;
        }

        .modal-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 50px 20px;
          text-align: center;
          gap: 6px;
        }
        .empty-ico {
          font-size: 28px;
          margin-bottom: 2px;
        }
        .empty-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .empty-sub {
          font-size: 12.5px;
          color: var(--text-secondary);
          max-width: 250px;
        }
        .btn-clear-all {
          margin-top: 8px;
          padding: 7px 14px;
          border-radius: 7px;
          border: none;
          background: var(--system-blue);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        /* ── Mini Middle Pop-Up Exit Modal ── */
        .exit-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: exit-fade-in 0.18s ease-out;
        }

        @keyframes exit-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .exit-modal-card {
          width: 100%;
          max-width: 300px;
          background: var(--sidebar-bg);
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          border: 0.5px solid var(--divider);
          border-radius: 18px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
          padding: 22px 20px 18px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: exit-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes exit-scale-in {
          from {
            opacity: 0;
            transform: scale(0.92);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .exit-modal-icon-wrap {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255, 59, 48, 0.12);
          color: #ff3b30;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
        }

        .exit-modal-title {
          font-size: 17px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0 0 6px;
          letter-spacing: -0.01em;
        }

        .exit-modal-desc {
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
          margin: 0 0 18px;
        }

        .exit-modal-actions {
          display: flex;
          gap: 10px;
          width: 100%;
        }

        .exit-btn-cancel {
          flex: 1;
          height: 40px;
          border-radius: 10px;
          border: 0.5px solid var(--divider);
          background: var(--item-hover);
          color: var(--text-primary);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .exit-btn-cancel:active {
          transform: scale(0.97);
          background: rgba(255, 255, 255, 0.12);
        }

        .exit-btn-confirm {
          flex: 1;
          height: 40px;
          border-radius: 10px;
          border: none;
          background: #ff3b30;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 3px 12px rgba(255, 59, 48, 0.35);
          transition: background 0.15s ease, transform 0.1s ease, filter 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .exit-btn-confirm:active {
          transform: scale(0.97);
          filter: brightness(0.92);
        }

        /* ════════════════════════════════════════════════════
           PC DESKTOP ZERO-SCROLL MASTER-DETAIL SUITE (min-width: 900px)
           ════════════════════════════════════════════════════ */
        @media (min-width: 900px) {
          .apple-dict-viewport {
            height: 100dvh;
            max-height: 100dvh;
            overflow: hidden; /* ABSOLUTELY ZERO PAGE SCROLLING! */
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .apple-app-window {
            width: 100vw;
            max-width: 100vw;
            height: 100dvh;
            max-height: 100dvh;
            border-radius: 0;
            border: none;
            box-shadow: none;
            flex-direction: row;
            margin: 0;
          }

          /* ── Left Navigation Sidebar (Master List) ── */
          .macos-sidebar {
            width: 285px;
            display: flex;
            flex-direction: column;
            background: var(--sidebar-bg);
            backdrop-filter: blur(40px);
            border-right: 0.5px solid var(--divider);
            flex-shrink: 0;
            user-select: none;
          }

          .traffic-lights {
            padding: 16px 18px;
            display: flex;
            align-items: center;
            gap: 8px;
            position: relative;
          }

          /* ── Letter Filter Button ── */
          .letter-filter-wrapper {
            margin-left: auto;
            position: relative;
          }

          .letter-filter-btn {
            width: 26px;
            height: 26px;
            border-radius: 6px;
            border: 0.5px solid var(--divider);
            background: var(--item-hover);
            color: var(--text-secondary);
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s, color 0.15s, border-color 0.15s;
            letter-spacing: 0;
          }

          .letter-filter-btn:hover {
            background: rgba(0, 122, 255, 0.12);
            border-color: var(--system-blue);
            color: var(--system-blue);
          }

          .letter-filter-btn.active {
            background: var(--system-blue);
            border-color: var(--system-blue);
            color: #ffffff;
          }

          .letter-filter-btn.open {
            background: rgba(0, 122, 255, 0.15);
            border-color: var(--system-blue);
            color: var(--system-blue);
          }

          /* ── Letter Dropdown Panel ── */
          .letter-dropdown {
            position: absolute;
            top: calc(100% + 6px);
            right: 0;
            z-index: 200;
            width: 240px;
            background: var(--sidebar-bg);
            border: 0.5px solid var(--divider);
            border-radius: 10px;
            padding: 10px;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(30px);
          }

          .apple-dict-viewport[data-theme="light"] .letter-dropdown {
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
          }

          .letter-dropdown-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            letter-spacing: 0.03em;
            text-transform: uppercase;
            margin-bottom: 8px;
            padding: 0 2px;
          }

          .letter-clear-btn {
            font-size: 11px;
            font-weight: 600;
            color: var(--system-blue);
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            text-transform: none;
          }

          .letter-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 4px;
          }

          .letter-tile {
            height: 28px;
            border-radius: 5px;
            border: 0.5px solid var(--divider);
            background: var(--item-hover);
            color: var(--text-primary);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.1s, color 0.1s;
          }

          .letter-tile:hover {
            background: rgba(0, 122, 255, 0.15);
            color: var(--system-blue);
            border-color: var(--system-blue);
          }

          .letter-tile.active {
            background: var(--system-blue);
            color: #ffffff;
            border-color: var(--system-blue);
          }

          .light {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0;
          }

          .red { background: #ff5f56; border: 0.5px solid #e0443e; }
          .yellow { background: #ffbd2e; border: 0.5px solid #dea123; }
          .green { background: #27c93f; border: 0.5px solid #1aab29; }
          .symbol { font-size: 8px; font-weight: 800; color: rgba(0, 0, 0, 0.7); line-height: 1; opacity: 0; transition: opacity 0.15s ease; }
          .traffic-lights:hover .symbol,
          .light:focus-visible .symbol { opacity: 1; }

          .sidebar-search {
            padding: 0 12px 12px;
          }

          .search-box {
            background: rgba(0, 0, 0, 0.16);
            border: 0.5px solid var(--divider);
            border-radius: 8px;
            display: flex;
            align-items: center;
            padding: 4px 8px;
            gap: 6px;
          }

          .apple-dict-viewport[data-theme="light"] .search-box {
            background: rgba(0, 0, 0, 0.05);
          }

          .search-icon { width: 14px; height: 14px; color: var(--text-muted); }
          .search-input {
            border: none;
            background: none;
            font-size: 13px;
            color: var(--text-primary);
            width: 100%;
            outline: none;
          }
          .search-input::placeholder { color: var(--text-muted); }

          .clear-search { border: none; background: none; color: var(--text-muted); font-size: 12px; cursor: pointer; }

          .sidebar-section-title {
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            padding: 6px 16px;
            letter-spacing: 0.03em;
          }

          .sidebar-word-list {
            flex: 1;
            overflow-y: auto;
            padding: 4px 8px 16px;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .sidebar-word-list::-webkit-scrollbar { width: 5px; }
          .sidebar-word-list::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }

          .word-row {
            height: 34px;
            padding: 0 10px;
            border-radius: 6px;
            border: none;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            transition: background 0.1s ease;
          }

          .word-row:hover:not(.selected) {
            background: var(--item-hover);
          }

          .word-row.selected {
            background: var(--system-blue);
            color: #ffffff;
          }

          .row-word { font-size: 13.5px; font-weight: 500; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
          .word-row.selected .row-word { font-weight: 600; }

          .row-badge { font-size: 11.5px; color: var(--text-secondary); font-style: italic; }
          .word-row.selected .row-badge { color: rgba(255, 255, 255, 0.85); }

          .sidebar-empty { padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px; }

          /* ── Main Workspace ── */

          .mobile-back-btn { display: none; }
          .mobile-toolbar-title { display: none; }
          .mobile-grid-btn { display: none; }
          .mobile-suite { display: none; }
          .mobile-counter-filter-btn { display: none; }
          .mobile-full-modal { display: none; }
          .mobile-nav-footer { display: none; }
          .nav-arrow-pc { display: flex; }

          .apple-segmented-control {
            display: inline-flex;
            background: var(--item-hover);
            border: 0.5px solid var(--divider);
            padding: 2px;
            border-radius: 7px;
          }

          .segment-item {
            padding: 4px 14px;
            border: none;
            background: none;
            border-radius: 5px;
            font-size: 12.5px;
            font-weight: 500;
            color: var(--text-secondary);
            cursor: pointer;
          }

          .segment-item.active {
            background: var(--workspace-bg);
            color: var(--text-primary);
            font-weight: 600;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
          }

          .dictionary-body-scroll {
            padding: 32px 40px;
          }

          .dictionary-body-scroll::-webkit-scrollbar { width: 6px; }
          .dictionary-body-scroll::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }

          .dict-word-profile {
            flex-direction: row;
            align-items: flex-start;
            gap: 40px;
          }

          .word-heading-line {
            flex: 0 0 auto;
            max-width: 35%;
          }

          .meanings-container {
            flex: 1 1 auto;
          }

          /* Apple Tables Grid */
          .apple-tables-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 24px;
          }

          .ns-table-container {
            border: 0.5px solid var(--divider);
            border-radius: 8px;
            background: var(--item-hover);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }

          .table-header {
            padding: 8px 14px;
            background: var(--table-header);
            border-bottom: 0.5px solid var(--divider);
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .table-title { font-size: 11.5px; font-weight: 700; color: var(--text-muted); letter-spacing: 0.05em; }
          .table-count { font-size: 11.5px; color: var(--text-muted); }

          .table-row {
            padding: 9px 14px;
            font-size: 13.5px;
          }

          .macos-status-bar {
            height: 28px;
            padding: 0 16px;
            font-size: 11.5px;
          }

          .status-center {
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }

          kbd {
            background: var(--item-hover);
            border: 0.5px solid var(--divider);
            padding: 1px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-primary);
          }

          .status-right { display: none; }
        }

        .dt-speaker-btn { display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--system-blue) 40%, transparent); background: transparent; color: var(--system-blue); cursor: pointer; padding: 0; flex-shrink: 0; transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); outline: none; opacity: 0.85; -webkit-tap-highlight-color: transparent; }
        .dt-speaker-btn:hover { opacity: 1; transform: scale(1.08); border-color: color-mix(in srgb, var(--system-blue) 70%, transparent); }
        .dt-speaker-btn:active { transform: scale(0.88); opacity: 0.7; }
        .dt-speaker-btn.speaking { opacity: 1; }
        .dt-speaker-btn.loading { opacity: 0.8; cursor: wait; }

        .ios-tick { animation: ios-tick-fade 1s steps(1) infinite; }
        @keyframes ios-tick-fade {
          0%   { opacity: 1; }
          8.3% { opacity: 0.85; }
          16.6%{ opacity: 0.7; }
          25%  { opacity: 0.55; }
          33.3%{ opacity: 0.42; }
          41.6%{ opacity: 0.32; }
          50%  { opacity: 0.24; }
          58.3%{ opacity: 0.18; }
          66.6%{ opacity: 0.15; }
          100% { opacity: 0.15; }
        }

        .ios-arc { opacity: 0; }
        .ios-arc.is-speaking { animation-duration: 2s; animation-timing-function: ease; animation-iteration-count: infinite; }
        .ios-arc-1.is-speaking { animation-name: ios-draw-1; }
        .ios-arc-2.is-speaking { animation-name: ios-draw-2; }
        .ios-arc-3.is-speaking { animation-name: ios-draw-3; }

        @keyframes ios-draw-1 {
          0%   { stroke-dashoffset: 100; opacity: 0; }
          16%  { stroke-dashoffset: 0;   opacity: 1; }
          75%  { stroke-dashoffset: 0;   opacity: 1; }
          85%  { stroke-dashoffset: 0;   opacity: 0; }
          100% { stroke-dashoffset: 100; opacity: 0; }
        }
        @keyframes ios-draw-2 {
          0%   { stroke-dashoffset: 100; opacity: 0; }
          16%  { stroke-dashoffset: 100; opacity: 0; }
          32%  { stroke-dashoffset: 0;   opacity: 1; }
          75%  { stroke-dashoffset: 0;   opacity: 1; }
          85%  { stroke-dashoffset: 0;   opacity: 0; }
          100% { stroke-dashoffset: 100; opacity: 0; }
        }
        @keyframes ios-draw-3 {
          0%   { stroke-dashoffset: 100; opacity: 0; }
          32%  { stroke-dashoffset: 100; opacity: 0; }
          48%  { stroke-dashoffset: 0;   opacity: 1; }
          75%  { stroke-dashoffset: 0;   opacity: 1; }
          85%  { stroke-dashoffset: 0;   opacity: 0; }
          100% { stroke-dashoffset: 100; opacity: 0; }
        }
      `;
