const fs = require('fs');

const file = 'frontend/app/adaptive-quiz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Normalize CRLF to LF so template literal replacements match perfectly!
content = content.replace(/\r\n/g, '\n');

// 1. Remove the import of CSS in page.tsx
content = content.replace("import './adaptive-quiz.css';\n", "");

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

const macosEnd = `            </div>
          </div>
        </div>
      </main>
    );`;

// We will explicitly replace the 4 known start wrappers:
const startWrapper1 = `      <div style={shellStyle}>
        {renderBackdrop}
        <div style={frameStyle}>`;
content = content.replace(startWrapper1, macosStartConfig); // config phase

const startWrapper2 = `      <div style={shellStyle}>
        {renderBackdrop}
        <div style={frameStyle}>`;
content = content.replace(startWrapper2, macosStartConfig); // briefing phase (it replaces the 2nd occurrence)

const startWrapper3 = `      <div style={shellStyle}>
        {renderBackdrop}
        <div style={{ ...frameStyle, maxWidth: 920 }}>`;
content = content.replace(startWrapper3, macosStartQuiz); // quiz phase

const startWrapper4 = `      <div style={shellStyle}>
        {renderBackdrop}
        <div style={{ ...frameStyle, maxWidth: 960 }}>`;
content = content.replace(startWrapper4, macosStartResults); // results phase

// We explicitly replace the 4 known end wrappers based on what immediately follows them:
const endWrapper1 = `        </div>
      </div>
    );
  }

  if (phase === 'briefing' && meta) {`;
content = content.replace(endWrapper1, macosEnd + `\n  }\n\n  if (phase === 'briefing' && meta) {`);

const endWrapper2 = `        </div>
      </div>
    );
  }

  if (phase === 'quiz') {`;
content = content.replace(endWrapper2, macosEnd + `\n  }\n\n  if (phase === 'quiz') {`);

const endWrapper3 = `        </div>
      </div>
    );
  }

  if (phase === 'results') {`;
content = content.replace(endWrapper3, macosEnd + `\n  }\n\n  if (phase === 'results') {`);

const endWrapper4 = `        </div>
      </div>
    );
  }

  return null;`;
content = content.replace(endWrapper4, macosEnd + `\n  }\n\n  return null;`);

// Remove `renderBackdrop` entirely
content = content.replace(/const renderBackdrop = \(\s*<div aria-hidden="true" style=\{backdropStyle\}>[\s\S]*?<\/div>\s*\);/g, '');

// Convert common styles
content = content.replace(/style=\{sectionCardStyle\}/g, 'className="section-card"');
content = content.replace(/style=\{\{\s*\.\.\.sectionCardStyle,\s*([^}]+)\}\}/g, 'className="section-card" style={{ $1 }}');

content = content.replace(/style=\{headingStyle\}/g, 'className="heading-title"');
content = content.replace(/style=\{\{\s*\.\.\.headingStyle,\s*([^}]+)\}\}/g, 'className="heading-title" style={{ $1 }}');

content = content.replace(/style=\{subtextStyle\}/g, 'className="subtext"');
content = content.replace(/style=\{\{\s*\.\.\.subtextStyle,\s*([^}]+)\}\}/g, 'className="subtext" style={{ $1 }}');

content = content.replace(/style=\{actionButtonStyle\}/g, 'className="action-btn"');
content = content.replace(/style=\{\{\s*\.\.\.actionButtonStyle,\s*([^}]+)\}\}/g, 'className="action-btn" style={{ $1 }}');

content = content.replace(/style=\{shellCardStyle\}/g, 'className="section-card"');
content = content.replace(/style=\{\{\s*\.\.\.shellCardStyle,\s*([^}]+)\}\}/g, 'className="section-card" style={{ $1 }}');

content = content.replace(/style=\{roundedCardStyle\}/g, 'className="section-card"');
content = content.replace(/style=\{\{\s*\.\.\.roundedCardStyle,\s*([^}]+)\}\}/g, 'className="section-card" style={{ $1 }}');

fs.writeFileSync(file, content);
console.log('Bulletproof refactoring complete with LF normalization.');
