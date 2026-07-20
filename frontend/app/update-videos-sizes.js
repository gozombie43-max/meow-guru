const fs = require('fs');

let css = fs.readFileSync('frontend/app/videos/page.tsx', 'utf8');

const replacements = [
  // Video chips
  [/\.video-chip \{\s*flex: 0 0 auto;\s*min-height: 42px;/g, '.video-chip {\n            flex: 0 0 auto;\n            min-height: 36px;\n            font-size: 0.9rem;'],
  [/\.video-chip \{\s*min-height: 56px;\s*border-radius: 14px;\s*padding: 0 22px;\s*font-size: 1\.18rem;\s*\}/g, '.video-chip {\n              min-height: 40px;\n              border-radius: 14px;\n              padding: 0 16px;\n              font-size: 0.95rem;\n            }'],
  
  // Thumb texts
  [/clamp\(2\.15rem, 10\.4vw, 4\.9rem\)/g, 'clamp(1.6rem, 6vw, 3rem)'],
  [/clamp\(2\.4rem, 12vw, 5\.4rem\)/g, 'clamp(1.8rem, 7vw, 3.2rem)'],
  [/clamp\(1\.8rem, 7vw, 3\.8rem\)/g, 'clamp(1.4rem, 5vw, 2.6rem)'],
  [/clamp\(0\.86rem, 3\.9vw, 1\.45rem\)/g, 'clamp(0.8rem, 3.5vw, 1.1rem)'], // thumb-secondary
  
  // Typography
  [/clamp\(1rem, 4\.2vw, 1\.45rem\)/g, 'clamp(0.95rem, 3.5vw, 1.15rem)'], // h2
  [/clamp\(0\.82rem, 3\.5vw, 1\.02rem\)/g, 'clamp(0.82rem, 3vw, 0.95rem)'], // p
  
  // Logos
  [/\.channel-logo \{\s*width: 38px;\s*height: 38px;/g, '.channel-logo {\n            width: 32px;\n            height: 32px;\n            font-size: 0.7rem;'],
  [/\.channel-logo \{\s*width: 48px;\s*height: 48px;\s*font-size: 0\.86rem;\s*\}/g, '.channel-logo {\n              width: 36px;\n              height: 36px;\n              font-size: 0.75rem;\n            }'],
  
  // Badges
  [/font-size: clamp\(0\.78rem, 3\.3vw, 1\.1rem\);/g, 'font-size: clamp(0.7rem, 2.5vw, 0.9rem);'],
  [/padding: 7px 10px;/g, 'padding: 4px 8px;'],
  
  // Desktop grid
  [/minmax\(320px, 1fr\)\); gap: 32px;/g, 'minmax(280px, 1fr)); gap: 20px;']
];

for (const [regex, replacement] of replacements) {
  css = css.replace(regex, replacement);
}

fs.writeFileSync('frontend/app/videos/page.tsx', css);
console.log('Typography and sizes reduced successfully!');
