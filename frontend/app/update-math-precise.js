const fs = require('fs');

let code = fs.readFileSync('frontend/app/mathematics/page.tsx', 'utf8');

// 1. Replace body.theme-dark .math-topics-page
let regex1 = /body\.theme-dark \.math-topics-page \{[\s\S]*?\}/;
let replace1 = `body.theme-dark {
          background: #000000;
        }

        body.theme-dark .math-topics-page {
          background: transparent;
          color: #ffffff;
          --math-header-bg: rgba(0, 0, 0, 0.72);
          --math-header-border: rgba(255, 255, 255, 0.08);
          --math-header-text: #ffffff;
          --math-card-border: rgba(255, 255, 255, 0.1);
          --math-card-shadow: none;
          --math-card-highlight: rgba(255, 255, 255, 0.04);
          --topic-text: #ffffff;
          --topic-subtext: rgba(235, 235, 245, 0.55);
          --topic-chevron: rgba(235, 235, 245, 0.3);
        }

        body.theme-dark .header-pill {
          box-shadow: none;
          backdrop-filter: saturate(180%) blur(20px);
          -webkit-backdrop-filter: saturate(180%) blur(20px);
        }`;
code = code.replace(regex1, replace1);

// 2. Remove glowing pseudo-elements in dark mode
let regex2 = /body\.theme-dark \.math-topics-page::before \{[\s\S]*?body\.theme-dark \.math-topics-page::after \{[\s\S]*?\}/;
let replace2 = `body.theme-dark .math-topics-page::before,
        body.theme-dark .math-topics-page::after {
          display: none;
        }`;
code = code.replace(regex2, replace2);

// 3. Dark mode topic thumb
let regex3 = /body\.theme-dark \.topic-thumb-wrap \{[\s\S]*?\}/;
let replace3 = `body.theme-dark .topic-thumb-wrap {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: none;
        }`;
code = code.replace(regex3, replace3);

// 4. PC layout grid replacement
let regex4 = /@media \(min-width: 768px\) \{[\s\S]*?\}\n      `\}<\/style>/;
let replace4 = `@media (min-width: 768px) {
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
          
          .header-pill {
            min-height: 64px;
            padding: 12px 20px;
            border-radius: 999px;
            max-width: 600px;
            margin: 0 auto;
          }

          .math-shell {
            max-width: 1240px;
            padding: 0 40px 80px;
          }

          .topic-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 16px;
            flex-direction: row;
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
code = code.replace(regex4, replace4);

fs.writeFileSync('frontend/app/mathematics/page.tsx', code);
console.log('Math CSS accurately patched!');
