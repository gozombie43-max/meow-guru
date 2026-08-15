const fs = require('fs');

const file = 'frontend/app/globals.css';
let content = fs.readFileSync(file, 'utf8');

// Remove the old specific scrollbar css I added
const oldScrollbarRegex = /\/\* --- Global macOS Window Scrollbar Styling --- \*\/[\s\S]*?body\.theme-dark \.macos-content::-webkit-scrollbar-thumb:hover \{\s*background-color: rgba\(255, 255, 255, 0\.4\);\s*border-width: 2px;\s*\}/;
content = content.replace(oldScrollbarRegex, '');

// Append the new universal scrollbar CSS
const universalScrollbar = `
/* --- Universal Scrollbar Styling --- */
*::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
body.theme-dark *::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.25);
  border: 3px solid transparent;
  background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.35);
  border-width: 2px;
}
body.theme-dark *::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.4);
  border-width: 2px;
}
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}
body.theme-dark * {
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}
`;

content += universalScrollbar;
fs.writeFileSync(file, content);
console.log('Universal scrollbar CSS applied to globals.css');
