const fs = require('fs');

const file = 'frontend/app/adaptive-quiz/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace style={sectionCardStyle} with className="section-card"
content = content.replace(/style=\{sectionCardStyle\}/g, 'className="section-card"');
// For overrides like style={{ ...sectionCardStyle, marginBottom: 16 }}
content = content.replace(/style=\{\{\s*\.\.\.sectionCardStyle,\s*([^}]+)\}\}/g, 'className="section-card" style={{ $1 }}');

// Replace style={headingStyle}
content = content.replace(/style=\{headingStyle\}/g, 'className="heading-title"');
content = content.replace(/style=\{\{\s*\.\.\.headingStyle,\s*([^}]+)\}\}/g, 'className="heading-title" style={{ $1 }}');

// Replace style={subtextStyle}
content = content.replace(/style=\{subtextStyle\}/g, 'className="subtext"');
content = content.replace(/style=\{\{\s*\.\.\.subtextStyle,\s*([^}]+)\}\}/g, 'className="subtext" style={{ $1 }}');

// Replace actionButtonStyle
content = content.replace(/style=\{actionButtonStyle\}/g, 'className="action-btn"');
content = content.replace(/style=\{\{\s*\.\.\.actionButtonStyle,\s*([^}]+)\}\}/g, 'className="action-btn" style={{ $1 }}');

// Replace shellCardStyle
content = content.replace(/style=\{shellCardStyle\}/g, 'className="section-card"');
content = content.replace(/style=\{\{\s*\.\.\.shellCardStyle,\s*([^}]+)\}\}/g, 'className="section-card" style={{ $1 }}');

// Replace roundedCardStyle
content = content.replace(/style=\{roundedCardStyle\}/g, 'className="section-card"');
content = content.replace(/style=\{\{\s*\.\.\.roundedCardStyle,\s*([^}]+)\}\}/g, 'className="section-card" style={{ $1 }}');

// Remove the unused style objects
const styleObjects = [
  'shellStyle',
  'frameStyle',
  'backdropStyle',
  'orbStyle',
  'shellCardStyle',
  'roundedCardStyle',
  'topicsModalCardStyle',
  'sectionCardStyle',
  'headingStyle',
  'subtextStyle',
  'badgeStyle',
  'actionButtonStyle'
];

for (const obj of styleObjects) {
  const regex = new RegExp(`const ${obj}: CSSProperties = \\{[\\s\\S]*?\\};\\n\\n`, 'g');
  content = content.replace(regex, '');
  
  // also try without the trailing newlines just in case
  const regex2 = new RegExp(`const ${obj}: CSSProperties = \\{[\\s\\S]*?\\};`, 'g');
  content = content.replace(regex2, '');
}

// Fix the closing divs
// Old structure:
//     return (
//       <div style={shellStyle}>
//         {renderBackdrop}
//         <div style={frameStyle}> ... </div> </div> );
// Since I already replaced the top two divs and `{renderBackdrop}` with ` <main...><div className="macos-window">...<div className="macos-content"><div className="phase-container">`,
// we now have `<main><div><aside><div><h2></h2></aside><div><div> ... </div></div></div></main>`.
// Specifically, 3 nested closing divs `</div></div></div>` followed by `</main>` instead of `</div></div>`.

content = content.replace(/<\/div>\s*<\/div>\s*\);\s*$/gm, '</div>\n        </div>\n      </div>\n    </main>\n  );');

content = content.replace(/<\/div>\s*<\/div>\s*\);\s*if \(/g, '</div>\n        </div>\n      </div>\n    </main>\n  );\n\n  if (');

// Note: {renderBackdrop} is now gone from the layout, so I should remove the `const renderBackdrop = ...` completely, as the CSS covers the background now.
content = content.replace(/const renderBackdrop = \([\s\S]*?\);\n/g, '');

fs.writeFileSync(file, content);
console.log('Styles cleaned and replaced with classes.');
