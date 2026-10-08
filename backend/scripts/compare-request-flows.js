import { readFile, writeFile } from 'node:fs/promises';

// Inputs: sanitized browser captures and request-completed JSONL from every API
// replica for the same capture window. Optional baseline uses the same shape.
const [afterFile, afterLogs, reportFile, beforeFile, beforeLogs] = process.argv.slice(2);
if (!afterFile || !afterLogs || !reportFile) throw new Error('Usage: node compare-request-flows.js after.json after-logs.jsonl report.json [before.json before-logs.jsonl]');
async function summarize(captureFile, logFile) {
  const capture = JSON.parse(await readFile(captureFile, 'utf8'));
  const logs = logFile ? (await readFile(logFile, 'utf8')).split('\n').filter(Boolean).flatMap(line => {
    try { const row = JSON.parse(line); return row.msg === 'request completed' ? [row] : []; } catch { return []; }
  }) : [];
  const byId = new Map(), seenLogs = new Set();
  let duplicateLogRows = 0;
  for (const row of logs) {
    if (!row.requestId) continue;
    const signature = JSON.stringify(row);
    if (seenLogs.has(signature)) { duplicateLogRows++; continue; }
    seenLogs.add(signature);
    // Transport retries deliberately retain a logical request ID. Count each
    // physical completion once, in order, rather than double-joining its work.
    const rows = byId.get(row.requestId) || [];
    rows.push(row); byId.set(row.requestId, rows);
  }
  for (const rows of byId.values()) rows.sort((a, b) => Number(a.time || 0) - Number(b.time || 0));
  const actions = new Map();
  for (const sample of capture.samples) {
    for (const action of sample.actions) {
      const row = actions.get(action.name) || { action: action.name, runs: 0, apiRequests: 0, matchedApiRequests: 0, mongoCommands: 0, authorizationCommands: 0, requestMs: [], automationMs: [], ids: new Map(), endpoints: new Map() };
      row.runs++; row.automationMs.push(action.automationElapsedMs); actions.set(action.name, row);
    }
    for (const request of sample.requests.filter(row => row.kind === 'api')) {
      const row = actions.get(request.action); if (!row) continue;
      row.apiRequests++; if (request.durationMs != null) row.requestMs.push(request.durationMs);
      const id = request.serverRequestId || request.requestId;
      if (id) row.ids.set(id, (row.ids.get(id) || 0) + 1);
      const endpoint = `${request.method || 'GET'} ${request.path || 'unknown'}`;
      row.endpoints.set(endpoint, (row.endpoints.get(endpoint) || 0) + 1);
      const log = byId.get(id)?.shift();
      if (log?.mongo) {
        row.matchedApiRequests++; row.mongoCommands += log.mongo.total;
        row.authorizationCommands += Object.entries(log.mongo.operations).filter(([key]) => key.startsWith('authorization:')).reduce((sum, [, count]) => sum + count, 0);
      }
    }
  }
  const percentile = values => values.length ? values.sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] : null;
  const start = Date.parse(capture.startedAt), end = Date.parse(capture.endedAt);
  const windowAvailable = Number.isFinite(start) && Number.isFinite(end) && logs.some(row => Number.isFinite(row.time));
  const windowRows = logs.filter(row => row.mongo && row.time >= start && row.time <= end && seenLogs.delete(JSON.stringify(row)));
  return { label: capture.label, target: capture.target, completed: capture.completed, project: capture.project, duplicateLogRows,
    serverWindow: { available: windowAvailable, completedRequests: windowAvailable ? windowRows.length : null, mongoCommands: windowAvailable ? windowRows.reduce((sum, row) => sum + row.mongo.total, 0) : null,
      scope: 'All completed API requests in the capture window, including SSR and ambient traffic; detached work excluded. Requires synchronized clocks and every replica log.' },
    actions: [...actions.values()].map(row => ({
    action: row.action, runs: row.runs, apiRequests: row.apiRequests, apiRequestsPerRun: row.apiRequests / row.runs,
    matchedApiRequests: row.matchedApiRequests, unmatchedApiRequests: row.apiRequests - row.matchedApiRequests,
    matchedMongoCommands: row.mongoCommands, matchedAuthorizationCommands: row.authorizationCommands,
    repeatedLogicalRequestIds: [...row.ids.values()].filter(count => count > 1).length,
    endpoints: Object.fromEntries(row.endpoints),
    requestP95Ms: percentile(row.requestMs), automationP95Ms: percentile(row.automationMs),
  })) };
}
const after = await summarize(afterFile, afterLogs), before = beforeFile ? await summarize(beforeFile, beforeLogs) : null;
if (before && (after.project !== before.project || after.target !== before.target || !after.completed || !before.completed)) throw new Error('Compare completed journeys on the same device and environment');
const comparison = before ? after.actions.map(row => {
  const baseline = before.actions.find(item => item.action === row.action);
  const completeMongo = baseline && !baseline.unmatchedApiRequests && !row.unmatchedApiRequests;
  return { action: row.action, apiRequestsPerRunDelta: baseline ? row.apiRequestsPerRun - baseline.apiRequestsPerRun : null,
    mongoCommandsPerRunDelta: completeMongo ? row.matchedMongoCommands / row.runs - baseline.matchedMongoCommands / baseline.runs : null,
    requestP95MsDelta: baseline?.requestP95Ms != null && row.requestP95Ms != null ? row.requestP95Ms - baseline.requestP95Ms : null };
}) : null;
await writeFile(reportFile, JSON.stringify({ before, after, comparison,
  limitations: 'Matched physical Mongo commands only; retries count separately and coalesced authorization belongs to its initiating request. Unmatched calls, SSR work and detached background work are excluded. Small-sample p95 is descriptive, not capacity evidence.' }, null, 2) + '\n');
console.log(`Comparison written to ${reportFile}`);
