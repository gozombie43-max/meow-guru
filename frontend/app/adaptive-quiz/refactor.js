const fs = require('fs');

const file = 'frontend/app/adaptive-quiz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes("import './adaptive-quiz.css';")) {
  content = content.replace("import { useThemeMode } from '@/hooks/useTheme';", "import { useThemeMode } from '@/hooks/useTheme';\nimport './adaptive-quiz.css';");
}

// Helper to replace the start of a phase return block
function replacePhaseStart(content, phaseIndicatorRegex, replacementStr) {
    return content.replace(phaseIndicatorRegex, replacementStr);
}

const macosStartConfig = `
      <main className="adaptive-quiz-page">
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
            <div className="phase-container">
`;

// 1. Config Phase
const configRegex = /<div style=\{shellStyle\}>\s*\{renderBackdrop\}\s*<div style=\{frameStyle\}>/g;
content = content.replace(configRegex, macosStartConfig);

// 2. Briefing Phase
const briefingRegex = /<div style=\{shellStyle\}>\s*\{renderBackdrop\}\s*<div style=\{frameStyle\}>/g;
// Wait, the configRegex already matched it if it's the exact same string!
// Let's just use the regex globally for the exact matches.

// 3. Quiz Phase (has custom maxWidth and padding)
const quizRegex = /<div style=\{shellStyle\}>\s*\{renderBackdrop\}\s*<div style=\{\{\s*\.\.\.frameStyle,\s*maxWidth:\s*840,\s*padding:\s*0\s*\}\}>/g;
content = content.replace(quizRegex, macosStartConfig); // We'll rely on CSS or child classes for padding.

// 4. Results Phase (has custom maxWidth)
const resultsRegex = /<div style=\{shellStyle\}>\s*\{renderBackdrop\}\s*<div style=\{\{\s*\.\.\.frameStyle,\s*maxWidth:\s*900\s*\}\}>/g;
content = content.replace(resultsRegex, macosStartConfig);

// Now replace the closing tags for these phases.
// The phases end with:
//         </div>
//       </div>
//     );
const closingRegex = /<\/div>\s*<\/div>\s*\);\s*(?=\}? else if|\}? if|}$)/gm;
// Wait, closingRegex is risky if there are other matching blocks. Let's do a more targeted replace.
// Let's write the updated content back.
fs.writeFileSync(file, content);
console.log('Wrappers replaced. Next step is manual adjustments.');
