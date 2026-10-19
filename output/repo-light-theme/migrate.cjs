const fs = require('node:fs');
const path = require('node:path');
const postcss = require('../../frontend/node_modules/postcss');
const root = path.resolve(__dirname, '../../frontend');
const apply = process.argv.includes('--apply');
const groups = {
  surface: 'fff ffffff fdfdfd fefefe white',
  canvas: 'f8fafc f9fafb fafafa f6f7f9 f5f6f8 f5f6fa f5f7f9 f8f9fc f7f8fa f6f8fa f5f5f7 f4f5f7 f2f2f7 f7f5fa fbfbfd f4f7fb f8f8fa f9f9fb f5f7fa f6f6f8 f8f9fa f5f6f7 f7f7f8 f8f8f8 f9f9f9',
  muted: 'f0f2f5 eef2f6 edf1f6 e9eef6 f1f5f9 eceef1 eef1f4 edf1f7 f1f3f9 f0f1f3 e5e5ea e2e8f0 f2f4f7 f3f4f6 eef0f4 eef0f3 f0f0f0 ebe7ef d0d9e4',
  border: 'dce3ec e1e4e8 e5e7eb e2e8f0 dfe3ea d8dee4 d1d5db d8d8dc e3e7eb eceef2 e5e5ea e3e6eb e5e7ed dce3ed ddd dddddd e0e0e0 e5e5e5 e6e6eb d0d7de d8d8e0 e2e2e7',
  text: '000 000000 111 111111 111827 0f172a 182438 1c1c1e 1f2937 242830 17202e 15171a 17181c 1c2533 172033 182230 24292f 212529 1d1d1f 202124',
  secondary: '334155 475569 4b5563 526176 606773 57606a 5d6675 636872 63636b 636366 647084 596579 586474 48484a 4d4758 374151 526170',
  tertiary: '64748b 6b7280 6e6e73 8e8e93 86868b 929aa4 94a3b8 66758a 7a828e 68707a 68686e 6e6a85 6b7280 647180 7c8899 9ca3af 6b6b70',
};
for (const key in groups) groups[key] = new Set(groups[key].split(' '));
const name = {surface:'surface',canvas:'canvas',muted:'surface-muted',border:'border',text:'text',secondary:'text-secondary',tertiary:'text-muted'};
function role(property) {
  if (/^(color|caret-color)$/.test(property)) return 'text';
  if (/^(background|background-color|background-image)$/.test(property)) return 'background';
  if (/^(border(?:-(?:top|bottom|left|right))?(?:-color)?|outline-color)$/.test(property)) return 'border';
  if (!property.startsWith('--')) return null;
  if (/border|separator|divider/.test(property)) return 'border';
  if (/text|label|ink|foreground|placeholder|spinner-color/.test(property)) return 'text';
  if (/bg|background|surface|canvas|card|field|fill|hover|soft|nav/.test(property) && !/shadow|blur/.test(property)) return 'background';
  if (/muted|secondary|tertiary|subtle|total|solved/.test(property) && !/shadow|blur/.test(property)) return 'text';
  return null;
}
function replaceValue(value, intent, explicitLight) {
  if (value.includes('var(')) return value;
  const token = (kind, original) => `var(--light-only-${name[kind]}, ${original})`;
  let updated = value.replace(/#[\da-f]{3,8}\b|\bwhite\b/gi, original => {
    const color = original.toLowerCase().replace('#','');
    let kind;
    if (intent === 'background') kind = ['surface','canvas','muted'].find(group => groups[group].has(color));
    if (intent === 'text') kind = ['text','secondary','tertiary'].find(group => groups[group].has(color));
    if (intent === 'border') kind = groups.border.has(color) ? 'border' : undefined;
    return kind ? token(kind, original) : original;
  });
  if (/^(rgba?|rgb)\(/i.test(value)) {
    const match = value.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)\s*[,/]\s*([\d.]+)(%)?\s*\)$/i);
    if (match) {
      const rgb = match.slice(1,4).map(Number), alpha = Number(match[4]) / (match[5] ? 100 : 1);
      if (intent === 'border' && Math.max(...rgb)-Math.min(...rgb) < 16 && Math.max(...rgb) < 130 && alpha < .3) updated = token('border', value);
      if (intent === 'background' && rgb.every(v => v === 255) && alpha >= .65) updated = token('surface', value);
      if (intent === 'background' && Math.max(...rgb)-Math.min(...rgb) < 16 && Math.max(...rgb) < 130 && alpha > 0 && alpha <= .12) updated = token('muted', value);
      if (intent === 'text' && Math.max(...rgb)-Math.min(...rgb) < 16 && Math.max(...rgb) < 100 && alpha >= .4) updated = token('secondary', value);
    }
  }
  return updated;
}
function files(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]); }
const report = [];
function transform(css, changes) {
  css.walkRules(rule=>{
    if (/dark|not\([^)]*light/.test(rule.selector)) return;
    let parent=rule.parent;
    while(parent && parent.type !== 'root') {
      if(parent.type === 'atrule' && (/keyframes/.test(parent.name) || /prefers-color-scheme:\s*dark/.test(parent.params))) return;
      parent=parent.parent;
    }
    const explicitLight=/theme-light|data-theme\s*=\s*['"]light/.test(rule.selector);
    rule.nodes?.filter(node=>node.type==='decl').forEach(d=>{
      const semantic = /success|error|danger|correct|wrong|incorrect|won|lost|positive|negative|toast|feedback/.test(rule.selector) || /^--(?:admin-(?:success|danger)|catalog-(?:success|warning)|battle-(?:green|red)|quiz-(?:success|error))/.test(d.prop);
      const intent=role(d.prop) || (semantic && d.prop.startsWith('--') && !/shadow/.test(d.prop) ? 'text' : null);if(!intent)return;
      let updated=replaceValue(d.value,intent,explicitLight);
      if (semantic && !d.value.includes('var(')) {
        const meanings = {
          success: ['#168258','#16845b','#18743b','#087f5b','#16a34a','#1a8f51','#15803d','#187643','#059669'],
          danger: ['#d63741','#cc3e4b','#c62828','#b42332','#dc2626','#ef4444','#c73644','#d70015','#c03432'],
          'success-soft': ['#e8f6ed','#f0fdf4','#ecfdf5','#f0fbf5','#e7f7ec'],
          'danger-soft': ['#fcebec','#fef2f2','#fff3f3','#fff1f2','#fee2e2'],
        };
        for (const [meaning,colors] of Object.entries(meanings)) if(colors.includes(d.value.toLowerCase())) updated=`var(--light-only-${meaning}, ${d.value})`;
      }
      if (d.prop === '--mac-desktop-gradient' && !d.value.includes('--light-only-canvas')) updated=`var(--light-only-canvas, ${d.value})`;
      if(updated !== d.value) { changes.push({line:d.source.start.line,selector:rule.selector,property:d.prop,before:d.value,after:updated});d.value=updated; }
    });
  });
}
for(const file of ['app','components','features'].flatMap(dir=>files(path.join(root,dir))).filter(f=>f.endsWith('.css'))) {
  if (/[/\\](dark-theme|light-theme|interface|globals)\.css$/.test(file)) continue;
  const source = fs.readFileSync(file,'utf8');
  const css = postcss.parse(source);
  const changes=[];
  transform(css,changes);
  if(!changes.length)continue;
  const relative=path.relative(root,file);
  const backup=path.join(__dirname,'source-before',relative);
  if(!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,source);}
  if(apply)fs.writeFileSync(file,css.toString());
  report.push({file:relative,changes});
}
const babel = require('../../node_modules/@babel/parser');
for(const file of ['app','components','features'].flatMap(dir=>files(path.join(root,dir))).filter(f=>f.endsWith('.tsx'))) {
  const source=fs.readFileSync(file,'utf8');
  if(!source.includes('<style'))continue;
  const ast=babel.parse(source,{sourceType:'module',plugins:['typescript','jsx']});
  const templates=[];
  function visit(node,inStyle=false){
    if(!node || typeof node !== 'object')return;
    if(node.type==='JSXElement' && node.openingElement.name.name==='style')inStyle=true;
    if(inStyle && node.type==='TemplateLiteral'){templates.push(node);return;}
    for(const [key,value] of Object.entries(node))if(!['loc','extra'].includes(key)) {
      if(Array.isArray(value))value.forEach(v=>visit(v,inStyle));else if(value && typeof value==='object')visit(value,inStyle);
    }
  }
  visit(ast);
  const changes=[],edits=[];
  for(const template of templates){
    const interpolations=[];
    let content='';
    template.quasis.forEach((q,i)=>{content+=source.slice(q.start,q.end);if(i<template.expressions.length){interpolations.push(source.slice(q.end,template.quasis[i+1].start));content+=`__STYLE_EXPR_${i}__`;}});
    let css;try{css=postcss.parse(content);}catch{continue;}
    const count=changes.length;
    transform(css,changes);
    if(changes.length===count)continue;
    let updated=css.toString().replace(/__STYLE_EXPR_(\d+)__/g,(_,i)=>interpolations[Number(i)]);
    edits.push({start:template.start+1,end:template.end-1,value:updated});
  }
  if(!changes.length)continue;
  const relative=path.relative(root,file);
  const backup=path.join(__dirname,'source-before',relative);
  if(!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.writeFileSync(backup,source);}
  let updated=source;
  for(const edit of edits.sort((a,b)=>b.start-a.start))updated=updated.slice(0,edit.start)+edit.value+updated.slice(edit.end);
  if(apply)fs.writeFileSync(file,updated);
  report.push({file:relative,changes});
}
const reportPath=path.join(__dirname,'migration.json');
if(apply && fs.existsSync(reportPath)) {
  const previous=JSON.parse(fs.readFileSync(reportPath,'utf8'));
  for(const row of previous){const current=report.find(x=>x.file===row.file);if(current)current.changes=[...row.changes,...current.changes];else report.push(row);}
}
fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify({apply,files:report.length,declarations:report.reduce((n,x)=>n+x.changes.length,0),summary:report.map(x=>({file:x.file,count:x.changes.length}))},null,2));
