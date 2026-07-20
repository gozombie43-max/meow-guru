const fs = require('fs');
let content = fs.readFileSync('frontend/app/videos/page.tsx', 'utf8');

const regex = /\.playlist-list \{\s*gap: 46px;\s*padding-top: 48px;\s*\}/;
content = content.replace(regex, '.playlist-list { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; padding-top: 48px; }');

fs.writeFileSync('frontend/app/videos/page.tsx', content);
console.log('Desktop layout fixed!');
