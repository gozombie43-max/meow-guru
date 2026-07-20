const fs = require('fs');

function processReasoning() {
  let code = fs.readFileSync('frontend/app/reasoning/page.tsx', 'utf8');

  // iOS Dark Theme Replacement
  const oldDarkStylesRegex = /body\.theme-dark \{[\s\S]*?\n      `\}<\/style>/;
  const newDarkStyles = `body.theme-dark {
          background: #000000;
        }

        body.theme-dark .page {
          --page-accent: #0a84ff;
          --page-accent-strong: #0071e3;
          --page-border: rgba(255, 255, 255, 0.1);
          --page-surface: #1c1c1e;
          --page-surface-2: #2c2c2e;
          --page-ink: #ffffff;
          --page-subink: rgba(235, 235, 245, 0.55);
          --page-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          background: transparent;
          color: var(--page-ink);
        }

        body.theme-dark .page::before,
        body.theme-dark .page::after {
          display: none;
        }

        body.theme-dark .topbar {
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
          box-shadow: none;
        }

        body.theme-dark .back-btn {
          color: var(--page-ink);
        }

        body.theme-dark .back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        body.theme-dark .topbar-title {
          color: var(--page-ink);
        }

        body.theme-dark .search-ico {
          color: var(--page-accent);
          opacity: 0.85;
        }

        body.theme-dark .search-field {
          background: var(--page-surface);
          color: var(--page-ink);
          box-shadow: none;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        body.theme-dark .search-field::placeholder {
          color: var(--page-subink);
        }

        body.theme-dark .search-field:focus {
          box-shadow: none;
          border-color: var(--page-accent);
        }

        body.theme-dark .search-clear {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
        }

        body.theme-dark .search-clear:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        body.theme-dark .tab-btn {
          background: var(--page-surface-2);
          border-color: var(--page-border);
          color: var(--page-subink);
        }

        body.theme-dark .tab-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--page-ink);
        }

        body.theme-dark .tab-active {
          background: var(--page-accent) !important;
          border-color: var(--page-accent) !important;
          color: #ffffff !important;
          box-shadow: none;
        }

        body.theme-dark .count-text {
          color: var(--page-subink);
        }

        body.theme-dark .clear-btn {
          color: var(--page-accent);
        }

        body.theme-dark .pill-card {
          background: var(--page-surface);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: none;
        }

        body.theme-dark .pill-card:hover {
          background: var(--page-surface-2);
        }

        body.theme-dark .pill-icon {
          box-shadow: none;
        }

        body.theme-dark .pill-name {
          color: var(--page-ink);
        }

        body.theme-dark .empty-title {
          color: var(--page-ink);
        }

        body.theme-dark .empty-sub {
          color: var(--page-subink);
        }
        
        /* ── DESKTOP PC DESIGN (>= 768px) ── */
        @media (min-width: 768px) {
          .body {
            max-width: 1240px; /* Wider max-width to fit more columns */
            padding: 32px 40px 80px;
          }

          /* Center search for a cleaner header look */
          .search-row {
            max-width: 500px;
            margin: 0 auto 20px;
          }

          /* Make tabs wrap and center instead of scrolling */
          .tabs-scroll {
            justify-content: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 24px;
            overflow: visible;
          }

          .tab-btn {
            height: 38px;
            padding: 0 20px;
          }

          .count-row {
            max-width: 100%;
            margin-bottom: 16px;
          }

          /* Ultra dense grid to eliminate scrolling */
          .pill-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 14px;
          }
          
          /* Keep cards horizontal and compact like mobile, just in a grid */
          .pill-card {
            padding: 10px 14px 10px 10px;
            border-radius: 16px;
          }

          .pill-icon {
            width: 42px;
            height: 42px;
            font-size: 1.1rem;
          }

          .pill-name {
            font-size: 0.95rem;
          }

          .topbar {
            height: 64px;
            padding: 0 40px;
          }
          
          .topbar-title {
            font-size: 1.1rem;
          }
        }
      \`}</style>`;

  code = code.replace(oldDarkStylesRegex, newDarkStyles);
  fs.writeFileSync('frontend/app/reasoning/page.tsx', code);
}

function processMath() {
  let code = fs.readFileSync('frontend/app/mathematics/page.tsx', 'utf8');

  const oldDarkStylesRegex = /body\.theme-dark \.math-topics-page \{[\s\S]*?\n      `\}<\/style>/;
  const newDarkStyles = `body.theme-dark {
          background: #000000;
        }

        body.theme-dark .math-topics-page {
          --math-header-bg: rgba(0, 0, 0, 0.72);
          --math-header-border: rgba(255, 255, 255, 0.08);
          --math-header-text: #ffffff;
          --math-card-border: rgba(255, 255, 255, 0.1);
          --math-card-shadow: none;
          --math-card-highlight: rgba(255, 255, 255, 0.04);
          --topic-text: #ffffff;
          --topic-subtext: rgba(235, 235, 245, 0.55);
          --topic-chevron: rgba(235, 235, 245, 0.3);
          background: transparent;
        }

        body.theme-dark .math-topics-page::before,
        body.theme-dark .math-topics-page::after {
          display: none;
        }

        body.theme-dark .math-header {
          background: var(--math-header-bg);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 0.5px solid var(--math-header-border);
          margin-bottom: 0;
        }
        
        body.theme-dark .topic-thumb-wrap {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: none;
        }

        @media (min-width: 768px) {
          .math-topics-page {
            padding: 0;
          }
          
          .math-header {
            position: sticky;
            top: 0;
            padding: 10px 40px;
            z-index: 10;
            margin-bottom: 32px;
          }
          
          .math-shell {
            max-width: 1240px;
            padding: 0 40px 80px;
          }

          .topic-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 16px;
          }

          .topic-card {
            border-radius: 20px;
            padding: 16px;
            gap: 14px;
            height: 100%;
          }

          .topic-thumb-wrap {
            width: 56px;
            height: 56px;
            border-radius: 12px;
          }

          .topic-title {
            font-size: 1.05rem;
          }

          .topic-subtitle {
            font-size: 0.88rem;
          }
        }
      \`}</style>`;

  code = code.replace(oldDarkStylesRegex, newDarkStyles);
  
  // Need to strip existing @media block if it exists before body.theme-dark (it actually exists inside it before our replacement, wait... no, @media is after body.theme-dark.
  // Wait, let's look at the old regex. It matches body.theme-dark up to </style>, which includes the old @media block! This is perfect.
  
  fs.writeFileSync('frontend/app/mathematics/page.tsx', code);
}

function processGA() {
  let code = fs.readFileSync('frontend/app/general-awareness/page.tsx', 'utf8');

  const oldDarkStylesRegex = /body\.theme-dark \{[\s\S]*?\n      `\}<\/style>/;
  const newDarkStyles = `body.theme-dark {
          background: #000000;
        }

        body.theme-dark .ga-topics-page {
          --ga-accent: #0a84ff;
          --ga-border: rgba(255, 255, 255, 0.08);
          --ga-surface: #1c1c1e;
          --ga-ink: #ffffff;
          --ga-subink: rgba(235, 235, 245, 0.55);
          background: transparent;
          color: var(--ga-ink);
        }

        body.theme-dark .ga-topics-page::before,
        body.theme-dark .ga-topics-page::after {
          display: none;
        }

        body.theme-dark .ga-header {
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
          border-bottom: 0.5px solid var(--ga-border);
          box-shadow: none;
        }

        body.theme-dark .header-back {
          color: var(--ga-ink);
        }

        body.theme-dark .header-back:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        body.theme-dark .header-title {
          color: var(--ga-ink);
        }

        body.theme-dark .search-icon {
          color: var(--ga-accent);
          opacity: 0.85;
        }

        body.theme-dark .search-input {
          background: var(--ga-surface);
          color: var(--ga-ink);
          box-shadow: none;
          border: 1px solid var(--ga-border);
        }

        body.theme-dark .search-input::placeholder {
          color: var(--ga-subink);
        }

        body.theme-dark .search-input:focus {
          box-shadow: none;
          border-color: var(--ga-accent);
        }

        body.theme-dark .topic-card {
          background: var(--ga-surface);
          border: 1px solid var(--ga-border);
          box-shadow: none;
        }

        body.theme-dark .topic-card:hover {
          background: #2c2c2e;
        }

        body.theme-dark .topic-card:focus-visible {
          outline: 2px solid var(--ga-accent);
        }

        body.theme-dark .topic-thumb-wrap {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: none;
        }

        body.theme-dark .topic-title {
          color: var(--ga-ink);
        }

        body.theme-dark .topic-subtitle {
          color: var(--ga-subink);
        }

        body.theme-dark .empty-state {
          background: var(--ga-surface);
          color: var(--ga-subink);
          border: 1px solid var(--ga-border);
          box-shadow: none;
        }

        /* ── DESKTOP PC DESIGN (>= 768px) ── */
        @media (min-width: 768px) {
          .ga-header .header-inner {
            max-width: 100%;
            padding: 12px 40px;
          }

          .content-wrap {
            max-width: 1240px;
            padding: 32px 40px 80px;
          }

          .search-wrap {
            max-width: 500px;
            margin: 0 auto 32px;
          }

          .topic-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
          }

          .topic-card {
            border-radius: 20px;
            padding: 14px;
            gap: 14px;
            height: 100%;
          }

          .topic-thumb-wrap {
            width: 56px;
            height: 56px;
            border-radius: 12px;
          }

          .topic-title {
            font-size: 1.05rem;
          }

          .topic-subtitle {
            font-size: 0.88rem;
          }
        }
      \`}</style>`;

  code = code.replace(oldDarkStylesRegex, newDarkStyles);
  fs.writeFileSync('frontend/app/general-awareness/page.tsx', code);
}

processReasoning();
processMath();
processGA();
console.log('All three pages updated!');
