/* Static inventory of MongoDB collection calls; does not execute project code. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const excluded = new Set(['node_modules', '.git', '.next', 'dist', 'coverage', '__tests__', 'test-results']);
const files = [];
function scan(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(item.name)) continue;
    const p = path.join(dir, item.name);
    if (item.isDirectory()) scan(p);
    else if (/\.(?:js|mjs|cjs|ts|tsx)$/.test(p) && !/\.(?:test|spec)\./.test(p) && !item.name.startsWith('mongodb-audit')) files.push(p);
  }
}
for (const dir of ['backend', 'frontend', 'generator', 'legacy', 'scripts', 'tools', 'contracts']) if (fs.existsSync(path.join(root, dir))) scan(path.join(root, dir));
const program = ts.createProgram(files, { allowJs: true, noResolve: true, noLib: true, skipLibCheck: true });
const checker = program.getTypeChecker();
const functions = new Map();
function visit(node, action) { action(node); ts.forEachChild(node, child => visit(child, action)); }
for (const file of files) visit(program.getSourceFile(file), node => {
  if (ts.isFunctionDeclaration(node) && node.name) { const key = node.name.text; if (!functions.has(key)) functions.set(key, []); functions.get(key).push(node); }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) { const key = node.name.text; if (!functions.has(key)) functions.set(key, []); functions.get(key).push(node.initializer); }
});
const chainMethods = new Set(['find', 'aggregate', 'sort', 'project', 'limit', 'skip', 'collation', 'batchSize', 'maxTimeMS', 'hint']);
const parameterCollections = {
  'backend/infrastructure/attachmentWorker.js': { jobs: 'runtimeJobs' },
  'backend/infrastructure/battleOutbox.js': { rooms: 'battleRooms' },
  'backend/infrastructure/durableQueue.js': { collection: '$parameter:runtimeJobs|conceptGroupMetadata' },
  'backend/infrastructure/keysetPage.js': { collection: '$parameter:notificationFeed|examUpdates' },
  'backend/services/questions/questionBackfill.js': { collection: 'questions' },
  'backend/services/training/questionMetadataBackfill.js': { collection: 'questions' },
};
function returns(fn) {
  if (!fn?.body) return null;
  if (!ts.isBlock(fn.body)) return fn.body;
  return fn.body.statements.find(ts.isReturnStatement)?.expression;
}
function origin(expr, seen = new Set()) {
  if (!expr || seen.has(expr)) return null;
  seen.add(expr);
  if (ts.isParenthesizedExpression(expr) || ts.isAwaitExpression(expr)) return origin(expr.expression, seen);
  if (ts.isIdentifier(expr)) {
    const symbol = checker.getSymbolAtLocation(expr);
    for (const decl of symbol?.declarations || []) if (ts.isVariableDeclaration(decl)) { const found = origin(decl.initializer, seen); if (found) return found; }
    return null;
  }
  if (!ts.isCallExpression(expr)) return null;
  if (ts.isPropertyAccessExpression(expr.expression)) {
    const method = expr.expression.name.text;
    if (method === 'collection') { const arg = expr.arguments[0]; return arg && ts.isStringLiteralLike(arg) ? arg.text : `$dynamic:${arg?.getText() || 'unknown'}`; }
    if (chainMethods.has(method)) return origin(expr.expression.expression, seen);
    return null;
  }
  if (ts.isIdentifier(expr.expression)) {
    const symbol = checker.getSymbolAtLocation(expr.expression);
    for (const decl of symbol?.declarations || []) {
      let fn = ts.isVariableDeclaration(decl) ? decl.initializer : decl;
      const result = origin(returns(fn), seen); if (result) return result;
    }
    const name = expr.expression.text;
    for (const fn of functions.get(name) || []) {
      // Imported collection getters have consistent definitions across files.
      if (!/^(get.*(?:Collection|Col)|.*Collection)$/.test(name)) continue;
      const result = origin(returns(fn), seen); if (result) return result;
    }
  }
  return null;
}
function caller(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p)) return p.name?.text || '<function>';
    if (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) {
      if (ts.isVariableDeclaration(p.parent)) return p.parent.name.getText();
      if (ts.isCallExpression(p.parent) && /router\./.test(p.parent.expression.getText())) return p.parent.expression.getText() + '(' + p.parent.arguments[0]?.getText() + ')';
    }
  }
  return '<module>';
}
const operations = new Set(['find', 'findOne', 'aggregate', 'countDocuments', 'estimatedDocumentCount', 'distinct', 'findOneAndUpdate', 'findOneAndDelete', 'updateOne', 'updateMany', 'replaceOne', 'insertOne', 'insertMany', 'deleteOne', 'deleteMany', 'bulkWrite', 'createIndex', 'createIndexes', 'dropIndex', 'listIndexes', 'watch']);
const inventory = [], unresolved = [];
for (const file of files) {
  const source = program.getSourceFile(file), relative = path.relative(root, file).replaceAll('\\', '/');
  visit(source, node => {
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) || !operations.has(node.expression.name.text)) return;
    const operation = node.expression.name.text, collection = origin(node.expression.expression) || parameterCollections[relative]?.[node.expression.expression.getText()];
    if (!collection) { if (operation !== 'find') unresolved.push({ file: relative, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, operation, receiver: node.expression.expression.getText() }); return; }
    let chain = node;
    while (chain.parent && ts.isPropertyAccessExpression(chain.parent) && ts.isCallExpression(chain.parent.parent)) chain = chain.parent.parent;
    const row = { id: `Q${String(inventory.length + 1).padStart(4, '0')}`, scope: relative.startsWith('backend/scripts/') || relative.startsWith('tools/') || relative.startsWith('scripts/') ? 'operator-script' : relative.startsWith('backend/migrations/') ? 'migration' : 'runtime', file: relative, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, caller: caller(node), collection, operation, query: node.arguments.map(a => a.getText()).join(', '), expression: chain.getText(), cursorOptions: {} };
    for (let n = chain; ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression); n = n.expression.expression) {
      const method = n.expression.name.text;
      if (chainMethods.has(method) && method !== operation) row.cursorOptions[method] = n.arguments.map(a => a.getText()).join(', ');
    }
    inventory.push(row);
  });
}
const out = { generatedAt: new Date().toISOString(), method: 'TypeScript AST with lexical variable resolution and collection getter tracing; dynamic collections and unresolved calls require manual review. No query-to-index correctness inferred automatically.', filesScanned: files.length, operations: inventory, unresolved };
fs.writeFileSync(path.join(root, 'MONGODB_ACCESS_AUDIT_QUERY_INVENTORY.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ files: files.length, operations: inventory.length, runtime: inventory.filter(q => q.scope === 'runtime').length, unresolved: unresolved.length }));
