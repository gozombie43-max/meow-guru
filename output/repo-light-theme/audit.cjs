const fs = require('node:fs');
const path = require('node:path');
const postcss = require('../../frontend/node_modules/postcss');
const root = path.resolve(__dirname, '../../frontend');
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]); }
const inventory = [];
for (const file of ['app', 'components', 'features'].flatMap(dir => files(path.join(root, dir))).filter(f => f.endsWith('.css'))) {
  const css = postcss.parse(fs.readFileSync(file, 'utf8'));
  const variables = [];
  const literals = [];
  css.walkRules(rule => {
    if (/dark|keyframe/i.test(rule.selector) || rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
    rule.walkDecls(d => {
      if (!/#(?:[\da-f]{3,8})\b|rgba?\(/i.test(d.value)) return;
      const row = { selector: rule.selector, property: d.prop, value: d.value, line: d.source.start.line };
      if (d.prop.startsWith('--')) variables.push(row);
      else if (/^(?:background(?:-color|-image)?|color|border(?:-color)?)$/.test(d.prop)) literals.push(row);
    });
  });
  inventory.push({ file: path.relative(root, file), variables, literals });
}
fs.writeFileSync(path.join(__dirname, 'audit.json'), JSON.stringify(inventory, null, 2));
console.log(JSON.stringify(inventory.map(({file, variables, literals}) => ({file, variables: variables.length, literals: literals.length})).filter(x => x.variables || x.literals), null, 2));
