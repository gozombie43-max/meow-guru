export function SubjectTopicStyles() {
  return (<style>{`
        @keyframes sg-up { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes sg-in { from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)} }

        /* ════════════════════════════════════
           THEME DEFAULTS (#0E0F12 / #16181D)
           ════════════════════════════════════ */
        html:has(.sg-page),
        body:has(.sg-page) {
          background: #0E0F12 !important;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        body.has-bottom-nav:has(.sg-page) {
          padding-bottom: 0 !important;
        }
        html:has(.sg-page)::-webkit-scrollbar,
        body:has(.sg-page)::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .sg-page {
          --bg: #0E0F12;
          --ui-header-surface: #0E0F12;
          --card: #16181D;
          --card-2: #1E2128;
          --sep: rgba(255, 255, 255, 0.06);
          --label: #E8EAED;
          --label-2: #9AA0A6;
          --label-3: #7B8189;

          box-sizing: border-box;
          height: calc(100dvh - var(--app-bottom-nav-occupied-height, calc(var(--app-bottom-nav-height) + var(--safe-bottom))));
          max-height: calc(100dvh - var(--app-bottom-nav-occupied-height, calc(var(--app-bottom-nav-height) + var(--safe-bottom))));
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          background: var(--bg);
          color: var(--label);
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", sans-serif;
          -webkit-font-smoothing: antialiased;
          padding: 0;
          transition: background .25s ease, color .25s ease;
        }
        .sg-page::-webkit-scrollbar,
        .sg-desktop-container::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        /* ── Pinned Top NavBar ── */
        .sg-navbar,
        .sg-page .sg-navbar[data-ui-chrome="header"] {
          position: relative;
          flex-shrink: 0;
          z-index: 50;
          padding: var(--safe-top) 14px 0;
          background: var(--bg, #0E0F12) !important;
          border-bottom: none !important;
          box-shadow: none !important;
        }
        .sg-nav-inline {
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          max-width: 500px;
          margin: 0 auto;
          padding: 0;
          border-bottom: none !important;
        }
        .sg-back {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--label, #E8EAED) !important;
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          margin: auto 0;
          width: 36px !important;
          height: 36px !important;
          background: transparent !important;
          border: none !important;
          padding: 0;
          cursor: pointer;
          border-radius: 50% !important;
          -webkit-tap-highlight-color: transparent;
          transform: none !important;
          transition: opacity 0.15s ease, background-color 0.15s ease;
        }
        .sg-back:hover,
        .sg-back:active {
          animation: none !important;
          transform: none !important;
          background: rgba(255, 255, 255, 0.08) !important;
          opacity: 0.8;
        }
        .sg-back svg { width: 20px; height: 20px; }
        .sg-nav-title {
          font-size: 16px;
          font-weight: 700;
          line-height: 24px;
          letter-spacing: -0.01em;
          max-width: calc(100% - 88px);
          margin: 0;
          color: var(--label, #E8EAED) !important;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }

        .sg-desktop-container {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior-y: contain;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
          max-width: 500px;
          margin: 0 auto;
          width: 100%;
          padding: 0 0 12px;
          box-sizing: border-box;
        }

        /* ── Banner (Formula & Notes) ── */
        .sg-banner-wrap {
          padding: 4px 14px 10px;
          animation: sg-in .28s cubic-bezier(.22,1,.36,1) both .02s;
        }
        .sg-banner {
          background: var(--card, #16181D);
          border: 1px solid var(--sep, rgba(255, 255, 255, 0.06));
          border-radius: 13px;
          padding: 10px 13px;
          min-height: 60px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0;
          text-decoration: none;
          -webkit-tap-highlight-color: transparent;
          transition: background-color .15s ease, border-color .15s ease;
        }
        .sg-banner:hover,
        .sg-banner:active {
          background: var(--card-2, #1E2128);
          border-color: rgba(10, 132, 255, 0.28);
        }
        .sg-banner-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          flex-shrink: 0;
          background: rgba(231, 38, 54, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sg-banner-icon svg {
          width: 24px;
          height: 24px;
          filter: none !important;
        }
        .sg-banner-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sg-banner-kicker {
          color: var(--label-2);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .sg-banner-title {
          font-size: 14.5px;
          font-weight: 600;
          line-height: 1.25;
          margin: 0;
          letter-spacing: -0.01em;
          color: var(--label, #E8EAED);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sg-banner-sub {
          font-size: 12px;
          font-weight: 450;
          color: var(--label-2, #9AA0A6);
          margin: 0;
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sg-banner-action {
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .sg-banner-open-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 30px;
          padding: 0 13px;
          border-radius: 999px;
          background: rgba(10, 132, 255, 0.14);
          border: 1px solid rgba(10, 132, 255, 0.28);
          color: var(--ios-system-blue, #0A84FF);
          font-size: 12.5px;
          font-weight: 600;
          letter-spacing: -0.01em;
          box-shadow: none;
          transition: background-color 0.15s ease, border-color 0.15s ease;
        }
        .sg-banner:hover .sg-banner-open-btn,
        .sg-banner:active .sg-banner-open-btn {
          background: rgba(10, 132, 255, 0.22);
        }

        /* ── Section label ── */
        .sg-section {
          font-size: 11.5px;
          font-weight: 700;
          color: var(--label-2, #9AA0A6);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 2px 16px 6px;
          animation: sg-up .26s ease both .05s;
        }

        /* ── PRACTICE MODES LIST ── */
        .sg-grid {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 7px;
          margin: 0 14px 0;
          background: transparent;
          overflow: visible;
          animation: sg-up .3s ease both .08s;
        }

        /* ── PRACTICE MODE CARD ── */
        .sg-card {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 9px 13px;
          min-height: 58px;
          border-radius: 13px;
          background: var(--card, #16181D);
          color: var(--label, #E8EAED);
          text-decoration: none;
          border: 1px solid var(--sep, rgba(255, 255, 255, 0.06));
          box-shadow: none;
          transition: background-color 0.15s ease, border-color 0.15s ease;
          cursor: pointer;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }

        .sg-card:hover,
        .sg-card:active {
          color: var(--label, #E8EAED);
          background: var(--card-2, #1E2128);
          border-color: rgba(10, 132, 255, 0.28);
        }

        .sg-card:focus-visible,
        .sg-banner:focus-visible {
          outline: 2px solid var(--ios-system-blue, #0A84FF);
          outline-offset: -2px;
        }

        .sg-card-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
          padding-right: 0;
          z-index: 2;
        }

        .sg-badge {
          --icon-color: color-mix(in srgb, var(--card-accent, #0A84FF) 78%, #b6becb);
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--icon-color) 14%, transparent) !important;
          color: var(--icon-color) !important;
          border: 0 !important;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: none !important;
        }

        .sg-badge svg {
          width: 18px;
          height: 18px;
          color: var(--icon-color) !important;
          stroke: currentColor;
        }

        .sg-card-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
          gap: 2px;
        }

        .sg-card-name {
          font-size: 14.5px;
          font-weight: 600;
          color: var(--label, #E8EAED);
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.01em;
        }

        .sg-card-sub {
          font-size: 12px;
          font-weight: 450;
          color: var(--label-2, #9AA0A6);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        }

        /* ── Right Question Count Column ── */
        .sg-card-tab {
          position: static;
          width: auto;
          height: auto;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          pointer-events: none;
          z-index: 2;
        }

        .sg-tab-bg-svg {
          display: none;
        }

        .sg-tab-action-wrap {
          position: static;
          width: auto;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .sg-card-qs-text {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
          gap: 2px;
          font-size: 13.5px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--label, #E8EAED);
          letter-spacing: -0.01em;
          white-space: nowrap;
          line-height: 1.15;
          background: none;
          border: none;
          padding: 0;
        }

        .sg-card-qs-text > span:first-child {
          color: var(--ios-system-blue, #0A84FF);
        }

        .sg-card-qs-text[data-zero="true"] > span:first-child {
          color: var(--label-2, #9AA0A6);
          font-weight: 600;
        }

        .sg-card-qs-label {
          color: var(--label-2, #9AA0A6);
          font-size: 11px;
          font-weight: 500;
          line-height: 1.15;
        }

        /* ════════════════════════════════════
           LIGHT THEME OVERRIDES
           ════════════════════════════════════ */
        html.theme-light:has(.sg-page),
        body.theme-light:has(.sg-page) {
          background: var(--light-canvas, #f4f5f7) !important;
        }
        body.theme-light .sg-page,
        html.theme-light .sg-page {
          --bg: var(--light-canvas, #f4f5f7);
          --ui-header-surface: var(--light-canvas, #f4f5f7);
          --card: var(--light-only-surface, #FFFFFF);
          --card-2: var(--light-border, #e5e7eb);
          --sep: var(--light-border, rgba(0, 0, 0, 0.08));
          --label: var(--light-text, #0f172a);
          --label-2: var(--light-text-secondary, #64748b);
          --label-3: var(--light-text-muted, #94a3b8);
          background: var(--bg);
        }
        body.theme-light .sg-navbar,
        html.theme-light .sg-navbar,
        body.theme-light .sg-page .sg-navbar[data-ui-chrome="header"],
        html.theme-light .sg-page .sg-navbar[data-ui-chrome="header"] {
          background: var(--light-canvas, #f4f5f7) !important;
          border-bottom: none !important;
        }
        body.theme-light .sg-banner,
        html.theme-light .sg-banner {
          background: var(--light-only-surface, #FFFFFF);
          border-color: var(--light-border, rgba(0, 0, 0, 0.08));
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
        }
        body.theme-light .sg-banner-open-btn,
        html.theme-light .sg-banner-open-btn {
          background: rgba(0, 113, 227, 0.1);
          border-color: rgba(0, 113, 227, 0.25);
          color: var(--ios-system-blue, #0071e3);
        }
        body.theme-light .sg-card,
        html.theme-light .sg-card {
          background: var(--light-only-surface, #FFFFFF);
          border-color: var(--light-border, rgba(0, 0, 0, 0.08));
          color: var(--light-only-text, #0f172a);
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
        }
        body.theme-light .sg-card:hover,
        html.theme-light .sg-card:hover {
          background: var(--light-canvas, #f8fafc);
          border-color: rgba(0, 113, 227, 0.3);
        }
        body.theme-light .sg-badge,
        html.theme-light .sg-badge {
          background: color-mix(in srgb, var(--card-accent, #007AFF) 12%, transparent) !important;
          color: var(--card-accent, #007AFF) !important;
        }
        body.theme-light .sg-badge svg,
        html.theme-light .sg-badge svg {
          color: var(--card-accent, #007AFF) !important;
          stroke: currentColor;
        }
        body.theme-light .sg-card-name,
        html.theme-light .sg-card-name {
          color: var(--light-only-text, #0f172a);
        }
        body.theme-light .sg-card-sub,
        html.theme-light .sg-card-sub {
          color: var(--light-only-text-muted, #64748b);
        }

        /* ════════════════════════════════════
           DESKTOP (PC) LAYOUT
           ════════════════════════════════════ */
        @media (min-width: 900px) {
          html:has(.sg-page),
          body:has(.sg-page) {
            overflow: auto;
          }
          .sg-page {
            height: auto;
            max-height: none;
            min-height: 100dvh;
            overflow: visible;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px;
          }
          .sg-desktop-container {
            flex: initial;
            overflow: visible;
            display: flex;
            flex-direction: row;
            align-items: stretch;
            gap: 50px;
            max-width: 960px;
            width: 100%;
            margin: 0 auto;
            padding: 0;
          }
          .sg-left-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .sg-right-pane {
            flex: 1.2;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }

          .sg-navbar,
          .sg-page .sg-navbar[data-ui-chrome="header"] {
            position: relative;
            padding: 0 0 28px 0;
            background: transparent !important;
            z-index: 1;
          }
          .sg-nav-inline {
            border-bottom: none;
            justify-content: flex-start;
            height: auto;
            max-width: none;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .sg-back {
            display: flex;
            position: static;
            margin: 0;
            width: 42px !important;
            height: 42px !important;
            background: var(--card) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
            border-radius: 12px !important;
            color: var(--label) !important;
            transform: none !important;
            transition: background 0.15s ease, opacity 0.15s ease;
          }
          .sg-back:hover {
            background: var(--card-2) !important;
          }
          .sg-nav-title {
            max-width: none;
            font-size: 2rem;
            font-weight: 800;
            letter-spacing: -0.04em;
            overflow: visible;
            text-overflow: clip;
            white-space: normal;
            text-align: left;
          }

          .sg-banner-wrap { padding: 0; }
          .sg-banner {
            border-radius: 16px;
            padding: 16px;
            margin: 0;
          }
          .sg-banner-icon {
            width: 42px;
            height: 42px;
            border-radius: 12px;
          }
          .sg-banner-icon svg { width: 28px; height: 28px; }
          .sg-banner-title { font-size: 1.05rem; font-weight: 700; }
          .sg-banner-sub { font-size: 0.82rem; margin-top: 2px; }
          .sg-section { padding: 0; margin-bottom: 14px; }

          .sg-grid {
            margin: 0;
            gap: 10px;
          }

          body.theme-light .sg-navbar { background: transparent !important; }
          body.theme-light .sg-back {
            background: var(--light-only-surface, #ffffff) !important;
            border-color: var(--light-only-border, rgba(0, 0, 0, 0.08)) !important;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
          }
          body.theme-light .sg-back:hover {
            background: var(--light-canvas) !important;
          }
        }
      `}</style>);
}
