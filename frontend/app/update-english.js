const fs = require('fs');
let code = fs.readFileSync('frontend/app/english/page.tsx', 'utf8');

const regex = /body\.theme-dark \{[\s\S]*?\n      `\}<\/style>/;
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
      \`}</style>`;

code = code.replace(regex, newDarkStyles);
fs.writeFileSync('frontend/app/english/page.tsx', code);
console.log('Done!');
