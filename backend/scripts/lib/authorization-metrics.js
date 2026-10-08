// Compare counter/histogram scrapes from one stable process. Quantiles are
// bucket estimates, not Atlas server-side execution percentiles.
export function summarizeAuthorizationMetrics(before, after, elapsedMs) {
  if (!before || !after) return null;
  const parse = lines => new Map(lines.flatMap(line => {
    const match = line.match(/^(meow_[a-z_]+)(\{[^}]*\})?\s+([\d.eE+-]+)$/);
    return match ? [[match[1] + (match[2] || ''), Number(match[3])]] : [];
  }));
  const old = parse(before), current = parse(after), differences = [];
  for (const [key, value] of current) {
    const delta = value - (old.get(key) || 0);
    if (delta < 0 || !Number.isFinite(delta)) throw new Error('Metrics reset or invalid sample; use scrapes from the same stable process');
    differences.push([key, delta]);
  }
  // Disappearing series usually means the second scrape reached another replica.
  for (const key of old.keys()) if (!current.has(key)) throw new Error('Metrics series disappeared; pin both scrapes to one API replica');
  const count = differences.filter(([key]) => key.startsWith('meow_mongo_commands_total{') && key.includes('purpose="authorization"'))
    .reduce((sum, [, value]) => sum + value, 0);
  const buckets = new Map();
  for (const [key, value] of differences) {
    if (!key.startsWith('meow_mongo_command_duration_seconds_bucket{') || !key.includes('purpose="authorization"') || !key.includes('outcome="success"')) continue;
    const bound = key.match(/\ble="([^"]+)"/)?.[1];
    if (bound) buckets.set(Number(bound === '+Inf' ? Infinity : bound), (buckets.get(Number(bound === '+Inf' ? Infinity : bound)) || 0) + value);
  }
  const total = buckets.get(Infinity) || 0, rank = total * 0.95;
  let previousBound = 0, previousCount = 0, p95Ms = null;
  for (const [bound, cumulative] of [...buckets].sort(([a], [b]) => a - b)) {
    if (total && cumulative >= rank) {
      p95Ms = 1000 * (Number.isFinite(bound)
        ? previousBound + (bound - previousBound) * (rank - previousCount) / (cumulative - previousCount)
        : previousBound);
      break;
    }
    previousBound = bound; previousCount = cumulative;
  }
  return { commands: count, commandsPerSecond: count * 1000 / elapsedMs, successfulCommandSamples: total,
    driverCommandP95MsEstimate: p95Ms, scope: 'One API process including ambient traffic; driver timing, not Atlas execution timing' };
}
