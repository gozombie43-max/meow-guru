const fs = require('fs');

const file = 'frontend/app/videos/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove the previously injected non-global styled-jsx scrollbar block
const badScrollbarRegex = /\s*\.macos-content::-webkit-scrollbar \{[\s\S]*?body\.theme-dark \.macos-content::-webkit-scrollbar-thumb:hover \{[\s\S]*?\}/;
content = content.replace(badScrollbarRegex, '');

// The correct global scrollbar block for styled-jsx
const correctScrollbarCSS = `
        :global(.macos-content::-webkit-scrollbar) {
          width: 12px;
        }
        :global(.macos-content::-webkit-scrollbar-track) {
          background: transparent;
        }
        :global(.macos-content::-webkit-scrollbar-thumb) {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        :global(body.theme-dark .macos-content::-webkit-scrollbar-thumb) {
          background-color: rgba(255, 255, 255, 0.25);
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        :global(.macos-content::-webkit-scrollbar-thumb:hover) {
          background-color: rgba(0, 0, 0, 0.35);
          border-width: 2px;
        }
        :global(body.theme-dark .macos-content::-webkit-scrollbar-thumb:hover) {
          background-color: rgba(255, 255, 255, 0.4);
          border-width: 2px;
        }
`;

const targetStr = `        .macos-content {
          flex: 1;
          padding: 32px;
          background: transparent;
          overflow-y: auto;
        }`;

// In case the target string was missing padding: 32px in my previous run
const targetStr1 = `        .macos-content {
          flex: 1;
          overflow-y: auto;
          background: transparent;
        }`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, targetStr + correctScrollbarCSS);
} else if (content.includes(targetStr1)) {
  content = content.replace(targetStr1, targetStr1 + correctScrollbarCSS);
} else {
  // Just inject it at the end of the styled-jsx block
  content = content.replace(`      \`}</style>`, correctScrollbarCSS + `\n      \`}</style>`);
}

fs.writeFileSync(file, content);
console.log('Fixed scrollbar CSS added to videos page.tsx');
