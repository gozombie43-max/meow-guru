const fs = require('fs');
let css = fs.readFileSync('frontend/app/globals.css', 'utf-8');

css = css.replace(/\.bottom-nav-item\.is-active \{[\s\S]*?\}/, '.bottom-nav-item.is-active {\n  color: #a855f7;\n  transform: scale(1.08);\n  text-shadow: none;\n}');
css = css.replace(/\.bottom-nav-item\.is-active \.bottom-nav-icon \{[\s\S]*?\}/, '.bottom-nav-item.is-active .bottom-nav-icon {\n  opacity: 1;\n  stroke: #a855f7;\n  filter: none;\n  animation: none;\n}');
css = css.replace(/\.bottom-pill-nav\.is-light \.bottom-nav-item\.is-active \{[\s\S]*?\}/, '.bottom-pill-nav.is-light .bottom-nav-item.is-active {\n  color: #a855f7;\n  text-shadow: none;\n}');
css = css.replace(/\.bottom-pill-nav\.is-light \.bottom-nav-item\.is-active::after \{[\s\S]*?\}/, '.bottom-pill-nav.is-light .bottom-nav-item.is-active::after {\n  display: none;\n}');
css = css.replace(/body\.theme-dark \.bottom-nav-item\.is-active \{[\s\S]*?\}/, 'body.theme-dark .bottom-nav-item.is-active {\n  color: #a855f7;\n  text-shadow: none;\n}');
css = css.replace(/body\.theme-dark \.bottom-nav-item\.is-active \.bottom-nav-icon \{[\s\S]*?\}/, 'body.theme-dark .bottom-nav-item.is-active .bottom-nav-icon {\n  stroke: #a855f7;\n  filter: none;\n}');

const centerBtnCss = \
.bottom-nav-center-item {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  z-index: 10;
}

.bottom-nav-center-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: #a855f7;
  color: white;
  box-shadow: 0 4px 14px rgba(168, 85, 247, 0.4);
  transition: transform 250ms ease, box-shadow 250ms ease;
  transform: translateY(-8px);
}

.bottom-nav-center-btn:hover,
.bottom-nav-center-btn:focus-visible {
  transform: scale(1.06) translateY(-10px);
  box-shadow: 0 6px 20px rgba(168, 85, 247, 0.5);
  outline: none;
}

.bottom-nav-center-btn:active {
  transform: scale(0.96) translateY(-8px);
}

.bottom-nav-center-btn svg {
  width: 32px;
  height: 32px;
  stroke: white;
  fill: none;
}

body.theme-dark .bottom-nav-center-btn {
  background: #a855f7;
  box-shadow: 0 4px 14px rgba(168, 85, 247, 0.4);
}
\;

if (!css.includes('bottom-nav-center-item')) {
  css += '\n' + centerBtnCss;
}

fs.writeFileSync('frontend/app/globals.css', css);
console.log('CSS updated successfully.');
