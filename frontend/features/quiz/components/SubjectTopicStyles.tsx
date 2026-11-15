export function SubjectTopicStyles() {
  return (<style>{`
        @keyframes sg-up { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }
        @keyframes sg-in { from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)} }

        /* ════════════════════════════════════
           SHARED THEME & SHELL RESET (--meow-*)
           ════════════════════════════════════ */
        html:has(.sg-page),
        body:has(.sg-page) {
          background: var(--meow-bg) !important;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        body.has-bottom-nav:has(.sg-page) {
          padding-bottom: 0 !important;
        }
        [data-meow-layout="configuration"]:has(.sg-page) main {
          padding: 0 !important;
          max-width: 100% !important;
        }
        html:has(.sg-page)::-webkit-scrollbar,
        body:has(.sg-page)::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .sg-page {
          box-sizing: border-box;
          width: 100%;
          height: calc(100dvh - var(--app-bottom-nav-occupied-height, calc(var(--app-bottom-nav-height) + var(--safe-bottom))));
          max-height: calc(100dvh - var(--app-bottom-nav-occupied-height, calc(var(--app-bottom-nav-height) + var(--safe-bottom))));
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          background: var(--meow-bg);
          color: var(--meow-text);
          font-family: var(--meow-font-sans);
          -webkit-font-smoothing: antialiased;
          padding: 0;
          transition: background-color var(--meow-duration-base) var(--meow-ease-standard),
            color var(--meow-duration-base) var(--meow-ease-standard);
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
          padding: calc(var(--meow-space-2) + var(--safe-top)) var(--meow-gutter-mobile) var(--meow-space-2);
          background: var(--meow-bg) !important;
          border-bottom: none !important;
          box-shadow: none !important;
        }
        .sg-nav-inline {
          min-height: var(--meow-control-h-md);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          max-width: 600px;
          margin: 0 auto;
          padding: 0;
          border-bottom: none !important;
        }
        .sg-back {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--meow-text) !important;
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          margin: auto 0;
          width: var(--meow-control-h-md) !important;
          height: var(--meow-control-h-md) !important;
          background: transparent !important;
          border: none !important;
          padding: 0;
          cursor: pointer;
          border-radius: var(--meow-radius-md) !important;
          -webkit-tap-highlight-color: transparent;
          transform: none !important;
          transition: opacity var(--meow-duration-fast) var(--meow-ease-standard),
            background-color var(--meow-duration-fast) var(--meow-ease-standard);
        }
        .sg-back:hover,
        .sg-back:active {
          animation: none !important;
          transform: none !important;
          background: var(--meow-surface-subtle) !important;
        }
        .sg-back:focus-visible {
          outline: 2px solid var(--meow-accent);
          outline-offset: 2px;
        }
        .sg-back svg { width: var(--meow-icon-md); height: var(--meow-icon-md); }
        .sg-nav-divider,
        .sg-nav-eyebrow,
        .sg-nav-sep,
        .sg-desktop-only-label {
          display: none;
        }
        .sg-nav-title-group {
          display: contents;
        }
        .sg-nav-title {
          font-size: var(--meow-text-lg);
          font-weight: 650;
          line-height: var(--meow-leading-lg);
          max-width: calc(100% - 96px);
          margin: 0;
          color: var(--meow-text) !important;
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
          max-width: 600px;
          margin: 0 auto;
          width: 100%;
          padding: 0 var(--meow-gutter-mobile) var(--meow-space-4);
          box-sizing: border-box;
        }

        /* ── Banner (Formula & Notes) ── */
        .sg-banner-wrap {
          padding: var(--meow-space-2) 0 var(--meow-space-5);
          animation: sg-in .28s cubic-bezier(.22,1,.36,1) both .02s;
        }
        .sg-banner {
          background: var(--meow-surface);
          border: none;
          border-radius: var(--meow-radius-lg);
          padding: var(--meow-space-4);
          min-height: 84px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 0;
          text-decoration: none;
          color: var(--meow-text);
          -webkit-tap-highlight-color: transparent;
          box-shadow: none;
          transition: background-color var(--meow-duration-fast) var(--meow-ease-standard);
        }
        .sg-banner:hover,
        .sg-banner:active {
          background: var(--meow-surface-subtle);
          box-shadow: none;
        }
        .sg-banner-icon {
          width: var(--meow-control-h-md);
          height: var(--meow-control-h-md);
          border-radius: var(--meow-radius-md);
          flex-shrink: 0;
          background: var(--meow-surface-subtle);
          border: none;
          color: var(--meow-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sg-banner-icon svg {
          width: var(--meow-icon-md);
          height: var(--meow-icon-md);
          filter: none !important;
        }
        .sg-banner-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: var(--meow-space-1);
        }
        .sg-banner-kicker {
          color: var(--meow-secondary);
          font-size: var(--meow-text-2xs);
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .sg-banner-title {
          font-size: var(--meow-text-md);
          font-weight: 600;
          line-height: 1.3;
          margin: 0;
          color: var(--meow-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sg-banner-sub {
          font-size: var(--meow-text-sm);
          font-weight: 450;
          color: var(--meow-secondary);
          margin: 0;
          line-height: var(--meow-leading-sm);
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
          min-height: var(--meow-control-h-sm);
          height: var(--meow-control-h-sm);
          padding: 0 var(--meow-space-4);
          border-radius: var(--meow-radius-sm);
          background: var(--meow-action-fill);
          border: 1px solid var(--meow-action-fill);
          color: var(--meow-on-accent);
          font-size: var(--meow-text-sm);
          font-weight: 600;
          letter-spacing: -0.01em;
          box-shadow: none;
          transition: background-color var(--meow-duration-fast) var(--meow-ease-standard),
            border-color var(--meow-duration-fast) var(--meow-ease-standard);
        }
        .sg-banner:hover .sg-banner-open-btn,
        .sg-banner:active .sg-banner-open-btn {
          background: var(--meow-action-fill-hover);
          border-color: var(--meow-action-fill-hover);
        }

        /* ── Section label ── */
        .sg-section {
          font-size: var(--meow-text-sm);
          font-weight: 600;
          line-height: var(--meow-leading-sm);
          color: var(--meow-secondary);
          padding: 0 2px var(--meow-space-3);
          animation: sg-up .26s ease both .05s;
        }

        /* ── PRACTICE MODES LIST ── */
        .sg-grid {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: var(--meow-space-3);
          margin: 0 0 var(--meow-space-4);
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
          gap: 14px;
          padding: 14px var(--meow-space-4);
          min-height: 72px;
          border-radius: var(--meow-radius-lg);
          background: var(--meow-surface);
          color: var(--meow-text);
          text-decoration: none;
          border: none;
          box-shadow: none;
          transition: transform 0.12s var(--meow-ease-standard),
            background-color var(--meow-duration-fast) var(--meow-ease-standard);
          cursor: pointer;
          overflow: hidden;
          -webkit-tap-highlight-color: transparent;
        }

        .sg-card:hover,
        .sg-card:active {
          color: var(--meow-text);
          background: var(--meow-surface-subtle);
          box-shadow: none;
        }

        .sg-card:focus-visible,
        .sg-banner:focus-visible {
          outline: 2px solid var(--meow-accent);
          outline-offset: -2px;
        }

        .sg-card:active {
          transform: scale(0.985);
        }
        @media (prefers-reduced-motion: reduce) {
          .sg-card:active { transform: none; }
        }

        .sg-card-left {
          display: flex;
          align-items: center;
          gap: var(--meow-space-3);
          min-width: 0;
          flex: 1;
          padding-right: 0;
          z-index: 2;
        }

        .sg-badge {
          width: var(--meow-control-h-md);
          height: var(--meow-control-h-md);
          border-radius: var(--meow-radius-md);
          background: var(--meow-surface-subtle) !important;
          color: var(--meow-secondary) !important;
          border: none !important;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: none !important;
        }

        .sg-badge svg {
          width: var(--meow-icon-md);
          height: var(--meow-icon-md);
          color: var(--meow-secondary) !important;
          stroke: currentColor;
        }

        .sg-badge img,
        .sg-banner-icon img {
          width: 28px;
          height: 28px;
          object-fit: contain;
          display: block;
        }
        .sg-card[data-empty="true"] .sg-badge img {
          filter: grayscale(1);
        }

        .sg-card-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
          gap: 3px;
        }

        .sg-card-name {
          font-size: var(--meow-text-md);
          font-weight: 600;
          color: var(--meow-text);
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sg-card-sub {
          font-size: var(--meow-text-sm);
          font-weight: 450;
          color: var(--meow-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.35;
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

        .sg-tab-action-wrap {
          position: static;
          width: auto;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .sg-card-qs-text {
          display: inline-flex;
          align-items: center;
          gap: var(--meow-space-1);
          height: 30px;
          padding: 0 10px;
          box-sizing: border-box;
          border-radius: var(--meow-radius-sm);
          background: var(--meow-surface-subtle);
          border: none;
          font-size: var(--meow-text-base);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--meow-text);
          white-space: nowrap;
          line-height: 1;
        }

        .sg-card-qs-text > span:first-child {
          color: var(--meow-text);
        }

        .sg-card-qs-text[data-zero="true"] {
          font-size: var(--meow-text-xs);
          font-weight: 600;
          color: var(--meow-secondary);
          background: var(--meow-surface-subtle);
        }
        .sg-card-qs-text[data-zero="true"] > span:first-child {
          color: inherit;
        }

        .sg-card-qs-label {
          color: var(--meow-secondary);
          font-size: var(--meow-text-2xs);
          font-weight: 600;
          line-height: 1;
          margin-top: 1px;
        }

        /* -- Count loading placeholder -- */
        @keyframes sg-fade { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes sg-count-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes sg-dim-in { from { opacity: 1; } to { opacity: 0.5; } }
        .sg-card-qs-skeleton {
          display: inline-block;
          width: 56px;
          height: 30px;
          border-radius: var(--meow-radius-sm);
          background: var(--meow-surface-subtle);
          animation: sg-fade 1.4s ease-in-out infinite;
        }
        .sg-grid[data-reveal="motion"] .sg-card-qs-text {
          animation: sg-count-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .sg-card-qs-skeleton,
          .sg-grid .sg-card-qs-text,
          .sg-grid .sg-card[data-empty="true"] .sg-badge,
          .sg-grid .sg-card[data-empty="true"] .sg-card-info { animation: none !important; }
        }

        /* -- Empty mode (no questions yet) -- */
        .sg-card[data-empty="true"],
        .sg-card[data-empty="true"]:hover,
        .sg-card[data-empty="true"]:active {
          cursor: default;
          pointer-events: none;
          transform: none !important;
          background: var(--meow-surface);
          border: none;
          box-shadow: none;
        }
        .sg-card[data-empty="true"] .sg-badge,
        .sg-card[data-empty="true"] .sg-card-info {
          opacity: 0.5;
        }
        .sg-grid[data-reveal="motion"] .sg-card[data-empty="true"] .sg-badge,
        .sg-grid[data-reveal="motion"] .sg-card[data-empty="true"] .sg-card-info {
          animation: sg-dim-in 0.28s ease-out both;
        }
        .sg-card[data-empty="true"] .sg-card-qs-text {
          background: var(--meow-surface-subtle);
          border: none;
          color: var(--meow-secondary);
        }

        /* ════════════════════════════════════
           DESKTOP (PC) LAYOUT (>= 768px)
           ════════════════════════════════════ */
        @media (min-width: 768px) {
          html:has(.sg-page),
          body:has(.sg-page) {
            background: #f6f6f7 !important;
            overflow: hidden;
          }
          .sg-page {
            height: 100dvh;
            max-height: 100dvh;
            min-height: 100dvh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            justify-content: flex-start;
            padding: 0;
            background: #f6f6f7;
            color: #111318;
            font-family: var(--font-sans, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          }

          /* Top Workspace Bar (56px) */
          .sg-navbar,
          .sg-page .sg-navbar[data-ui-chrome="header"] {
            position: relative;
            height: 56px;
            min-height: 56px;
            padding: 0 20px !important;
            background: #ffffff !important;
            border-bottom: 1px solid rgba(15, 17, 21, 0.08) !important;
            display: flex;
            align-items: center;
            z-index: 20;
          }
          .sg-nav-inline {
            border-bottom: none;
            justify-content: flex-start;
            height: 100%;
            min-height: 0;
            max-width: none;
            width: 100%;
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .sg-back {
            display: inline-flex;
            position: static;
            margin: 0;
            width: 36px !important;
            height: 36px !important;
            min-width: 36px !important;
            min-height: 36px !important;
            background: #ffffff !important;
            border: 1px solid rgba(15, 17, 21, 0.08) !important;
            border-radius: 8px !important;
            color: #4a505c !important;
            transform: none !important;
            transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
          }
          .sg-back:hover {
            background: #eceef1 !important;
            border-color: rgba(15, 17, 21, 0.14) !important;
            color: #111318 !important;
          }
          .sg-back svg {
            width: 16px;
            height: 16px;
          }
          .sg-nav-divider {
            display: inline-block;
            width: 1px;
            height: 18px;
            background: rgba(15, 17, 21, 0.08);
            flex-shrink: 0;
          }
          .sg-nav-title-group {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }
          .sg-nav-eyebrow {
            display: inline-block;
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
            color: #4a505c;
            white-space: nowrap;
          }
          .sg-nav-sep {
            display: inline-block;
            font-size: 14px;
            color: #767d89;
          }
          .sg-nav-title {
            max-width: none;
            font-size: 16px;
            font-weight: 600;
            line-height: 22px;
            letter-spacing: -0.015em;
            color: #111318 !important;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: left;
          }

          /* Full-Width Scrollable Workspace */
          .sg-desktop-container {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 28px;
            max-width: none;
            width: 100%;
            margin: 0;
            padding: 24px 20px 40px;
          }
          .sg-right-pane {
            order: 1;
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
          }
          .sg-left-pane {
            order: 2;
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
          }

          .sg-section {
            padding: 0;
            margin: 0;
            font-size: 13px;
            font-weight: 600;
            line-height: 18px;
            color: #4a505c;
            animation: none;
          }
          .sg-desktop-only-label {
            display: block;
          }

          /* Practice Modes Grid (Full Width) */
          .sg-grid {
            margin: 0;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            animation: none;
          }
          @media (min-width: 1100px) {
            .sg-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }

          .sg-card {
            padding: 18px 20px;
            min-height: 84px;
            border-radius: 12px;
            background: #ffffff;
            border: 1px solid rgba(15, 17, 21, 0.08);
            color: #111318;
            transition: background-color 140ms ease, border-color 140ms ease;
          }
          .sg-card:hover {
            background: #fcfcfd;
            border-color: rgba(15, 17, 21, 0.16);
          }
          .sg-card:active {
            transform: none;
          }
          .sg-badge {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            background: #f6f6f7 !important;
            border: 1px solid rgba(15, 17, 21, 0.06) !important;
          }
          .sg-card-name {
            font-size: 16px;
            font-weight: 600;
            line-height: 22px;
            letter-spacing: -0.015em;
            color: #111318;
          }
          .sg-card-sub {
            font-size: 13px;
            font-weight: 400;
            line-height: 18px;
            color: #4a505c;
          }
          .sg-card-qs-text {
            height: 30px;
            padding: 0 10px;
            border-radius: 6px;
            background: #f0f1f3;
            border: 1px solid rgba(15, 17, 21, 0.06);
            font-size: 13px;
            font-weight: 600;
            color: #111318;
          }
          .sg-card-qs-text > span:first-child {
            color: #111318;
          }
          .sg-card-qs-label {
            color: #4a505c;
            font-size: 11px;
            font-weight: 500;
          }
          .sg-card[data-empty="true"],
          .sg-card[data-empty="true"]:hover {
            background: #ffffff;
            border: 1px solid rgba(15, 17, 21, 0.06);
          }
          .sg-card[data-empty="true"] .sg-card-qs-text {
            background: #f6f6f7;
            border: 1px solid rgba(15, 17, 21, 0.06);
            color: #767d89;
          }

          /* Study Resource Card (Formula / Fact Notes) */
          .sg-banner-wrap {
            padding: 0;
            animation: none;
          }
          .sg-banner {
            border-radius: 12px;
            padding: 18px 20px;
            min-height: 84px;
            margin: 0;
            background: #ffffff;
            border: 1px solid rgba(15, 17, 21, 0.08);
            color: #111318;
            transition: background-color 140ms ease, border-color 140ms ease;
          }
          .sg-banner:hover {
            background: #fcfcfd;
            border-color: rgba(15, 17, 21, 0.16);
          }
          .sg-banner-icon {
            width: 44px;
            height: 44px;
            border-radius: 10px;
            background: #f6f6f7;
            border: 1px solid rgba(15, 17, 21, 0.06);
          }
          .sg-banner-title {
            font-size: 16px;
            font-weight: 600;
            line-height: 22px;
            letter-spacing: -0.015em;
            color: #111318;
          }
          .sg-banner-sub {
            font-size: 13px;
            font-weight: 400;
            line-height: 18px;
            color: #4a505c;
            margin-top: 2px;
          }
          .sg-banner-open-btn {
            height: 32px;
            min-height: 32px;
            padding: 0 14px;
            border-radius: 8px;
            background: #111318;
            border: 1px solid #111318;
            color: #ffffff;
            font-size: 13px;
            font-weight: 500;
            transition: opacity 140ms ease;
          }
          .sg-banner:hover .sg-banner-open-btn {
            background: #111318;
            border-color: #111318;
            opacity: 0.9;
          }
        }
      `}</style>);
}
