const fs = require('fs');
let css = fs.readFileSync('frontend/app/page.module.css', 'utf8');

// 1. Replace dark theme variables
const darkRegex = /\.dark \{([\s\S]*?)\}/;
const iosDark = `.dark {
  --bg: #000000;
  --surface: #1c1c1e;
  --surface-soft: #2c2c2e;
  --text: #ffffff;
  --muted: rgba(235, 235, 245, 0.55);
  --line: rgba(255, 255, 255, 0.1);
  --purple: #0a84ff;
  --purple-2: #0071e3;
  --orange: #ff9f0a;
  --shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  background: #000000;
}

/* iOS dark mode overrides */
.dark .sidebar { background: #1c1c1e; border-right-color: rgba(255,255,255,0.08); }
.dark .topbar { background: rgba(0,0,0,0.72); backdrop-filter: saturate(180%) blur(20px); border-bottom: 0.5px solid rgba(255,255,255,0.08); }
.dark .logoText strong:first-child { color: #0a84ff; }
.dark .railLink { color: rgba(235,235,245,0.5); }
.dark .railActive { color: #0a84ff; background: rgba(10,132,255,0.12); }
.dark .premium { background: #1c1c1e; border-color: rgba(255,255,255,0.08); box-shadow: none; }
.dark .premium a { background: #0a84ff; }
.dark .premiumIcon { background: rgba(10,132,255,0.2); color: #0a84ff; }
.dark .hero { border-color: rgba(255,255,255,0.07); background: linear-gradient(105deg, rgba(28,28,30,0.98) 0 42%, transparent 43%), linear-gradient(180deg, rgba(10,132,255,0.06), rgba(10,132,255,0.01)); border-radius: 16px; }
.dark .wave { background: linear-gradient(135deg, #0a84ff 0%, #0055d4 100%); }
.dark .subjectCard { background: #1c1c1e; border-color: rgba(255,255,255,0.07); box-shadow: none; }
.dark .subjectCard:hover { background: #2c2c2e; border-color: rgba(255,255,255,0.12); }
.dark .resourceCard { background: rgba(10,132,255,0.1); border-color: rgba(10,132,255,0.18); }
.dark .battleCard { background: rgba(191,90,242,0.1); border-color: rgba(191,90,242,0.18); }
.dark .quizCard { background: radial-gradient(circle at 76% 22%, rgba(10,132,255,0.3), transparent 34%), linear-gradient(135deg, #1c1c1e, #2c2c2e); border: 1px solid rgba(255,255,255,0.08); }
.dark .recentSection, .dark .featureStrip { border-left-color: rgba(255,255,255,0.08); border-top-color: rgba(255,255,255,0.08); }
.dark .featureItem:nth-child(1) { color: #0a84ff; }
.dark .featureItem:nth-child(2) { color: #30d158; }
.dark .featureItem:nth-child(3) { color: #64d2ff; }
.dark .featureItem:nth-child(4) { color: #ff9f0a; }
.dark .primaryCta, .dark .continueButton { background: linear-gradient(135deg, #ff9f0a, #ff6b00); box-shadow: 0 8px 20px rgba(255,106,0,0.28); }
.dark .loginButton { border-color: #0a84ff; color: #0a84ff; }`;
css = css.replace(darkRegex, iosDark);

// 2. Fix hero image in all breakpoints
css = css.replace(/\.heroImage\s*\{([\s\S]*?)\}/g, (match, body) => {
  let newBody = body;
  
  // Replace bottom
  newBody = newBody.replace(/bottom:\s*-[0-9]+px;/, 'top: 0;\n    bottom: 0;');
  
  // Ensure object-fit
  if (!newBody.includes('object-fit')) {
    if (newBody.includes('z-index')) {
      newBody = newBody.replace(/z-index/g, 'object-fit: contain;\n    object-position: top center;\n    z-index');
    } else {
      newBody = newBody.replace(/\}$/, '    object-fit: contain;\n    object-position: top center;\n  }');
    }
  }
  
  // Add object-fit if it was missed
  if (!newBody.includes('object-fit')) {
    newBody += '\n    object-fit: contain;\n    object-position: top center;';
  }
  
  // Fix height
  newBody = newBody.replace(/height:\s*auto;/, 'height: 100%;');
  
  return `.heroImage {${newBody}}`;
});

fs.writeFileSync('frontend/app/page.module.css', css);
console.log('Successfully updated CSS.');
