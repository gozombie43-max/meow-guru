const fs = require('fs');

let css = fs.readFileSync('frontend/app/mock-test/page.module.css', 'utf8');

// Replace dark mode variables in both media query and body.theme-dark block
const oldDarkVarsRegex = /--primary: #8a57ff;\s*--primary-light: #b08dff;\s*--primary-bg: #2a1b4d;\s*--bg: #0f172a;\s*--card: #1e293b;\s*--text-dark: #f8fafc;\s*--text-muted: #94a3b8;\s*--text-light: #64748b;\s*--border: #334155;/g;

const newDarkVars = `--primary: #0a84ff;
    --primary-light: #47a1ff;
    --primary-bg: #11284d;
    --bg: #000000;
    --card: #1c1c1e;
    --text-dark: #ffffff;
    --text-muted: rgba(235, 235, 245, 0.55);
    --text-light: rgba(235, 235, 245, 0.3);
    --border: rgba(255, 255, 255, 0.08);`;

css = css.replace(oldDarkVarsRegex, newDarkVars);

// Replace the surface background overrides
const oldSurface1 = /background: #0f172a;/g;
css = css.replace(oldSurface1, 'background: #000000;');

// Replace desktop dark mode header styles
const oldDesktopDarkHeaderRegex = /:global\(body\.theme-dark\) \.header,\s*:global\(html\.theme-dark\) \.header \{[\s\S]*?\}/;
const newDesktopDarkHeader = `:global(body.theme-dark) .header,
  :global(html.theme-dark) .header {
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border-color: rgba(255, 255, 255, 0.08);
  }`;
css = css.replace(oldDesktopDarkHeaderRegex, newDesktopDarkHeader);

// We should also add mobile dark mode header frosted glass.
// We can just append it before the @media (min-width: 768px) block.
if (!css.includes(':global(body.theme-dark) .header {')) {
  css = css.replace(
    /@media \(min-width: 768px\)/,
    `:global(body.theme-dark) .header {
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

@media (min-width: 768px)`
  );
}

fs.writeFileSync('frontend/app/mock-test/page.module.css', css);
console.log('Mock-test dark theme replaced with iOS HIG!');
