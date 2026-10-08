import { expect, it } from 'vitest';
import { summarizeAuthorizationMetrics } from '../lib/authorization-metrics.js';

const scrape = count => [
  `meow_mongo_commands_total{collection="users",command="find",purpose="authorization",outcome="success"} ${count}`,
  ...[['0.005', 0], ['0.025', count], ['+Inf', count]].map(([le, n]) => `meow_mongo_command_duration_seconds_bucket{collection="users",command="find",purpose="authorization",outcome="success",le="${le}"} ${n}`),
];
it('subtracts existing traffic and estimates p95 inside histogram buckets', () => {
  expect(summarizeAuthorizationMetrics(scrape(10), scrape(30), 10000)).toMatchObject({
    commands: 20, commandsPerSecond: 2, successfulCommandSamples: 20, driverCommandP95MsEstimate: 24,
  });
  expect(summarizeAuthorizationMetrics(scrape(10), scrape(10), 1000).driverCommandP95MsEstimate).toBeNull();
  expect(summarizeAuthorizationMetrics(null, null, 1000)).toBeNull();
});
it('rejects reset counters or scrapes which lost a replica series', () => {
  expect(() => summarizeAuthorizationMetrics(scrape(30), scrape(10), 1000)).toThrow('reset');
  expect(() => summarizeAuthorizationMetrics(scrape(10), [], 1000)).toThrow('disappeared');
});
