const fs = require('fs');

let css = fs.readFileSync('frontend/app/mock-test/page.module.css', 'utf8');

const oldPageGrad = /:global\(body\.theme-dark\) \.page,\s*:global\(html\.theme-dark\) \.page \{\s*background:\s*radial-gradient[\s\S]*?linear-gradient[\s\S]*?;\s*\}/;
const newPageGrad = `:global(body.theme-dark) .page,
  :global(html.theme-dark) .page {
    background: transparent;
  }`;

css = css.replace(oldPageGrad, newPageGrad);

// Adding detailHeader dark mode overrides.
const detailHeaderOverride = `
:global(body.theme-dark) .detailHeader {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  box-shadow: none;
}
:global(body.theme-dark) .detailHeader::after {
  display: none;
}
:global(body.theme-dark) .detailHeader .iconBtn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}
`;

// Append it right before the @media (min-width: 768px) block if not already there
if (!css.includes(':global(body.theme-dark) .detailHeader {')) {
  css = css.replace(
    /@media \(min-width: 768px\)/,
    detailHeaderOverride + '\n@media (min-width: 768px)'
  );
}

fs.writeFileSync('frontend/app/mock-test/page.module.css', css);
console.log('Mock-test dark theme fine-tuned with detail header and no page background!');
