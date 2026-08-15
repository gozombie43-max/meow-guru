const fs = require('fs');

const file = 'frontend/app/adaptive-quiz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Inject the CSS import
if (!content.includes("import './adaptive-quiz.css';")) {
  content = content.replace("import { useThemeMode } from '@/hooks/useTheme';", "import { useThemeMode } from '@/hooks/useTheme';\nimport './adaptive-quiz.css';");
}

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

// 2. Replace the start wrappers
const string1 = `      <div style={shellStyle}>
        {renderBackdrop}
        <div style={frameStyle}>`;
content = content.replace(new RegExp(escapeRegExp(string1), 'g'), macosStartConfig);

const string2 = `      <div style={shellStyle}>
        {renderBackdrop}
        <div style={{ ...frameStyle, maxWidth: 920 }}>`;
// we map it to phase-container with an extra max-width class or inline style
content = content.replace(new RegExp(escapeRegExp(string2), 'g'), macosStartConfig.replace('className="phase-container"', 'className="phase-container quiz-phase"'));

const string3 = `      <div style={shellStyle}>
        {renderBackdrop}
        <div style={{ ...frameStyle, maxWidth: 960 }}>`;
content = content.replace(new RegExp(escapeRegExp(string3), 'g'), macosStartConfig.replace('className="phase-container"', 'className="phase-container results-phase"'));

// 3. Replace the end wrappers
const endString = `        </div>
      </div>
    );`;
const macosEnd = `            </div>
          </div>
        </div>
      </main>
    );`;
content = content.replace(new RegExp(escapeRegExp(endString), 'g'), macosEnd);

// 4. Replace other style variables safely
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

// Helper
function escapeRegExp(string) {
  return string.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

fs.writeFileSync(file, content);
console.log('Safe refactoring completed.');
