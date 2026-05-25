const fs = require('fs');
let css = fs.readFileSync('c:/Users/91906/Ai ssc/frontend/app/play/play.css', 'utf8');
css = css.replace(/\/\* ── Badge ── \*\/[\s\S]*?\/\* ── Cards ── \*\//, '/* ── Cards ── */');
fs.writeFileSync('c:/Users/91906/Ai ssc/frontend/app/play/play.css', css);
