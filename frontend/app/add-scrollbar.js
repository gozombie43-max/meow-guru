const fs = require('fs');

const cssToAdd = `
/* --- macOS Scrollbar Styling --- */
.macosContent::-webkit-scrollbar {
  width: 12px;
}
.macosContent::-webkit-scrollbar-track {
  background: transparent;
}
.macosContent::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  border: 3px solid transparent;
  background-clip: padding-box;
}
:global(body.theme-dark) .macosContent::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.25);
  border: 3px solid transparent;
  background-clip: padding-box;
}
.macosContent::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.35);
  border-width: 2px;
}
:global(body.theme-dark) .macosContent::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.4);
  border-width: 2px;
}
`;

const file = 'frontend/app/mock-test/page.module.css';
let content = fs.readFileSync(file, 'utf8');
content += cssToAdd;
fs.writeFileSync(file, content);
console.log('Scrollbar CSS added.');
