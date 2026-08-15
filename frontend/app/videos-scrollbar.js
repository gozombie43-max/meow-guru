const fs = require('fs');

const scrollbarCSS = `
        .macos-content::-webkit-scrollbar {
          width: 12px;
        }
        .macos-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .macos-content::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 10px;
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        body.theme-dark .macos-content::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.25);
          border: 3px solid transparent;
          background-clip: padding-box;
        }
        .macos-content::-webkit-scrollbar-thumb:hover {
          background-color: rgba(0, 0, 0, 0.35);
          border-width: 2px;
        }
        body.theme-dark .macos-content::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.4);
          border-width: 2px;
        }
`;

const file = 'frontend/app/videos/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find the .macos-content block in the desktop media query
const targetStr = `        .macos-content {
          flex: 1;
          overflow-y: auto;
          background: transparent;
        }`;

content = content.replace(targetStr, targetStr + scrollbarCSS);

fs.writeFileSync(file, content);
console.log('Scrollbar CSS added to videos page.tsx');
