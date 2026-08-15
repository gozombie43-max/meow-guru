const fs = require('fs');

const file = 'frontend/app/adaptive-quiz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const macosStartConfig = `      <main className="adaptive-quiz-page">
        <div className="macos-window">
          <aside className="macos-sidebar">
            <div className="macos-traffic-lights">
              <div className="traffic-light close"></div>
              <div className="traffic-light minimize"></div>
              <div className="traffic-light maximize"></div>
            </div>
            <h2 className="macos-sidebar-title">Adaptive Engine</h2>
          </aside>
          <div className="macos-content">
            <div className="phase-container">`;

const macosStartQuiz = macosStartConfig.replace('className="phase-container"', 'className="phase-container quiz-phase"');
const macosStartResults = macosStartConfig.replace('className="phase-container"', 'className="phase-container results-phase"');

// Replace the start wrappers
content = content.replace(
  /<div\s+style=\{shellStyle\}>\s*\{renderBackdrop\}\s*<div\s+style=\{frameStyle\}>/g,
  macosStartConfig
);

content = content.replace(
  /<div\s+style=\{shellStyle\}>\s*\{renderBackdrop\}\s*<div\s+style=\{\{\s*\.\.\.frameStyle,\s*maxWidth:\s*840,\s*padding:\s*0\s*\}\}>/g,
  macosStartQuiz
);

content = content.replace(
  /<div\s+style=\{shellStyle\}>\s*\{renderBackdrop\}\s*<div\s+style=\{\{\s*\.\.\.frameStyle,\s*maxWidth:\s*920\s*\}\}>/g,
  macosStartQuiz
);

content = content.replace(
  /<div\s+style=\{shellStyle\}>\s*\{renderBackdrop\}\s*<div\s+style=\{\{\s*\.\.\.frameStyle,\s*maxWidth:\s*960\s*\}\}>/g,
  macosStartResults
);

const macosEnd = `            </div>
          </div>
        </div>
      </main>
    );`;

// Replace closing wrappers: </div>\s*</div>\s*);
content = content.replace(/<\/div>\s*<\/div>\s*\);\s*(?=\}? else if|\}? if|}$)/g, macosEnd + '\n');
// Wait, if there are multiple closing tags, they might not match `} if`.
// Let's just find `</div>\s*</div>\s*);`
content = content.replace(/<\/div>\s*<\/div>\s*\);/g, macosEnd);

// Also remove `const renderBackdrop = (` all the way to `);`
// Safe way: just regex remove the whole thing:
content = content.replace(/const renderBackdrop = \(\s*<div aria-hidden="true" style=\{backdropStyle\}>[\s\S]*?<\/div>\s*\);/, '');

fs.writeFileSync(file, content);
console.log('Fixed wrappers with robust regex.');
