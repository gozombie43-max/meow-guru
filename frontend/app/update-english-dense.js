const fs = require('fs');
let code = fs.readFileSync('frontend/app/english/page.tsx', 'utf8');

// 1. Revert JSX structure
code = code.replace(/<aside className="pc-sidebar">([\s\S]*?)<\/aside>/, '$1');
code = code.replace(/<section className="pc-main">([\s\S]*?)<\/section>/, '$1');

// 2. Replace the Desktop CSS block
const oldDesktopCssRegex = /\/\* ── DESKTOP PC DESIGN \(>= 768px\) ── \*\/[\s\S]*?\n      `\}<\/style>/;
const newDesktopCss = `/* ── DESKTOP PC DESIGN (>= 768px) ── */
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

code = code.replace(oldDesktopCssRegex, newDesktopCss);

fs.writeFileSync('frontend/app/english/page.tsx', code);
console.log('Successfully updated to dense PC layout.');
