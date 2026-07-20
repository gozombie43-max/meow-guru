const fs = require('fs');
let content = fs.readFileSync('frontend/app/videos/page.tsx', 'utf8');

// The file currently looks like:
/*
          .video-chip {
              min-height: 40px;
              border-radius: 14px;
              padding: 0 16px;
              font-size: 0.95rem;
          .playlist-stack {
*/

const badRegex = /\.video-chip \{\s*min-height: 40px;\s*border-radius: 14px;\s*padding: 0 16px;\s*font-size: 0\.95rem;\s*\.playlist-stack \{/;

const fix = `.video-chip {
              min-height: 40px;
              border-radius: 14px;
              padding: 0 16px;
              font-size: 0.95rem;
            }

            .playlist-list {
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
              gap: 24px;
              padding-top: 48px;
            }

          .playlist-stack {`;

content = content.replace(badRegex, fix);
fs.writeFileSync('frontend/app/videos/page.tsx', content);
console.log('Fixed broken CSS!');
