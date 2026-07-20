const fs = require('fs');

let css = fs.readFileSync('frontend/app/videos/page.tsx', 'utf8');

const iOSDarkTheme = `--video-page-bg: #000000;
            --video-page-fg: #ffffff;
            --video-filter-bg: rgba(0, 0, 0, 0.72);
            --video-filter-shadow: inset 0 -0.5px 0 rgba(255, 255, 255, 0.1);
            --video-filter-backdrop: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
            --video-chip-bg: rgba(255, 255, 255, 0.08);
            --video-chip-fg: rgba(235, 235, 245, 0.6);
            --video-chip-border: rgba(255, 255, 255, 0.08);
            --video-chip-active-bg: #ffffff;
            --video-chip-active-fg: #000000;
            --video-chip-active-border: #ffffff;
            --video-chip-press-bg: rgba(255, 255, 255, 0.12);
            --video-chip-active-press-bg: #e5e5ea;
            --video-stack-border: rgba(255, 255, 255, 0.08);
            --video-stack-shadow: none;
            --video-stack-filter: none;
            --video-stack-divider: rgba(255, 255, 255, 0.08);
            --video-focus-inner: #000000;
            --video-focus-outer: #0a84ff;
            --video-focus-shadow: none;
            --video-channel-bg: rgba(255, 255, 255, 0.08);
            --video-channel-border: rgba(255, 255, 255, 0.08);
            --video-channel-fg: #ffffff;
            --video-channel-shadow: none;
            --video-title-fg: #ffffff;
            --video-muted-fg: rgba(235, 235, 245, 0.6);
            --video-more-fg: #ffffff;
            --video-more-press-bg: rgba(255, 255, 255, 0.1);
            --video-empty-fg: rgba(235, 235, 245, 0.6);
            --video-card-bg: #1c1c1e;
            --video-card-border: rgba(255, 255, 255, 0.08);
            --video-card-shadow: none;
            --video-card-padding: 10px;`;

// Replace body.theme-dark .videos-page { ... }
const oldDarkBlock1 = /body\.theme-dark \.videos-page \{[\s\S]*?--video-card-padding: 10px;\s*\}/;
css = css.replace(oldDarkBlock1, `body.theme-dark { background: #000000; }
        body.theme-dark .videos-page {\n${iOSDarkTheme}\n        }`);

// Replace body:not(.theme-light) .videos-page { ... }
const oldDarkBlock2 = /body:not\(\.theme-light\) \.videos-page \{[\s\S]*?--video-card-padding: 10px;\s*\}/;
css = css.replace(oldDarkBlock2, `body:not(.theme-light) .videos-page {\n${iOSDarkTheme}\n          }`);

// Also fix the desktop layout to be an ultra-dense grid, like the other pages
const desktopMediaRegex = /@media \(min-width: 768px\) \{([\s\S]*?)\}/;

css = css.replace(desktopMediaRegex, (match, inner) => {
  let updated = inner.replace(/\.videos-shell \{\s*max-width: 760px;\s*\}/, '.videos-shell { max-width: 1240px; }');
  updated = updated.replace(/\.playlist-list \{\s*gap: 46px;\s*padding-top: 48px;\s*\}/, '.playlist-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 32px; padding-top: 48px; }');
  return `@media (min-width: 768px) {${updated}}`;
});

fs.writeFileSync('frontend/app/videos/page.tsx', css);
console.log('Videos iOS dark theme applied!');
