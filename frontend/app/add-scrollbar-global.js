const fs = require('fs');

const globalScrollbarCSS = `
/* --- Global macOS Window Scrollbar Styling --- */
.macosContent::-webkit-scrollbar,
.macos-content::-webkit-scrollbar {
  width: 12px;
}
.macosContent::-webkit-scrollbar-track,
.macos-content::-webkit-scrollbar-track {
  background: transparent;
}
.macosContent::-webkit-scrollbar-thumb,
.macos-content::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
body.theme-dark .macosContent::-webkit-scrollbar-thumb,
body.theme-dark .macos-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.25);
  border: 3px solid transparent;
  background-clip: padding-box;
}
.macosContent::-webkit-scrollbar-thumb:hover,
.macos-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.35);
  border-width: 2px;
}
body.theme-dark .macosContent::-webkit-scrollbar-thumb:hover,
body.theme-dark .macos-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.4);
  border-width: 2px;
}
`;

const file = 'frontend/app/globals.css';
let content = fs.readFileSync(file, 'utf8');
content += globalScrollbarCSS;
fs.writeFileSync(file, content);
console.log('Global scrollbar CSS added.');
