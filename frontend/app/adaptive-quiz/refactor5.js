const fs = require('fs');

const file = 'frontend/app/adaptive-quiz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. We remove the import of CSS in page.tsx (it's already handled in globals.css)
// We'll just remove the whole import block if present.
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
    );
  }`;

// Replace ONLY closing wrappers that belong to the main `if` blocks
content = content.replace(/<\/div>\s*<\/div>\s*\);\s*\}/g, macosEnd);

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
console.log('Fixed syntax correctly.');
