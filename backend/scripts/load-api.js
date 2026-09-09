// Read-only load probe. Run against local/staging fixtures with an explicit target.
const base = process.env.LOAD_BASE_URL;
if (!base) throw new Error('Set LOAD_BASE_URL to a local or staging API');
const requests = Math.max(1, Math.min(10000, Number(process.env.LOAD_REQUESTS) || 200));
const concurrency = Math.max(1, Math.min(100, Number(process.env.LOAD_CONCURRENCY) || 8));
const p95Budget = Number(process.env.LOAD_P95_MS) || 1000;
const path = process.env.LOAD_PATH || '/api/questions/session?subject=mathematics&limit=50';
let next = 0, errors = 0;
const durations = [];
const started = performance.now();
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next++ < requests) {
    const start = performance.now();
    try {
      const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000) });
      await response.arrayBuffer();
      if (!response.ok) errors++;
    } catch { errors++; }
    durations.push(performance.now() - start);
  }
}));
durations.sort((a, b) => a - b);
const p95Ms = durations[Math.ceil(durations.length * 0.95) - 1];
console.log(JSON.stringify({ requests: durations.length, concurrency, errors, p95Ms: Math.round(p95Ms), elapsedMs: Math.round(performance.now() - started), p95Budget }));
if (errors || p95Ms > p95Budget) process.exitCode = 1;
