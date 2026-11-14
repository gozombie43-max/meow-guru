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
            padding: var(--meow-space-10);
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
            width: var(--meow-control-h-md) !important;
            height: var(--meow-control-h-md) !important;
            background: var(--meow-surface) !important;
            border: 1px solid var(--meow-border) !important;
            border-radius: var(--meow-radius-md) !important;
            color: var(--meow-text) !important;
            transform: none !important;
            transition: background-color var(--meow-duration-fast) var(--meow-ease-standard),
              opacity var(--meow-duration-fast) var(--meow-ease-standard);
          }
          .sg-back:hover {
            background: var(--meow-surface-subtle) !important;
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
            border-radius: var(--meow-radius-lg);
            padding: var(--meow-space-4);
            margin: 0;
          }
          .sg-banner-icon {
            width: var(--meow-control-h-md);
            height: var(--meow-control-h-md);
            border-radius: var(--meow-radius-md);
          }
          .sg-banner-icon svg { width: var(--meow-icon-md); height: var(--meow-icon-md); }
          .sg-banner-title { font-size: 1.05rem; font-weight: 700; }
          .sg-banner-sub { font-size: 0.85rem; margin-top: 2px; }
          .sg-section { padding: 0; margin-bottom: var(--meow-space-2); }

          .sg-grid {
            margin: 0;
            gap: var(--meow-space-3);
          }
        }
      `}</style>);
}
