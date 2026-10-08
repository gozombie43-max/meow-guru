import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import { AUTH_VALIDATION_COMMENT, attachMongoOperationMetrics, mongoRequestContext } from '../mongoOperationMetrics.js';
import { mongoCommands, mongoCommandLatency } from '../metrics.js';

it('counts failed and retried driver attempts with bounded labels and request attribution', () => {
  const client = new EventEmitter(), context = { total: 0, operations: {} };
  attachMongoOperationMetrics(client);
  const counter = vi.spyOn(mongoCommands, 'inc'), latency = vi.spyOn(mongoCommandLatency, 'observe');
  try {
    mongoRequestContext.run(context, () => {
      for (const [requestId, result] of [[1, 'commandFailed'], [2, 'commandSucceeded']]) {
        client.emit('commandStarted', { requestId, commandName: 'find', command: { find: 'users', comment: AUTH_VALIDATION_COMMENT, filter: { secret: 'not a label' } } });
        client.emit(result, { requestId, commandName: 'find', duration: 25 });
      }
      client.emit('commandStarted', { requestId: 3, commandName: 'getMore', command: { collection: 'tenant-private-name' } });
      client.emit('commandSucceeded', { requestId: 3, commandName: 'getMore', duration: 30000 });
    });
    expect(context).toEqual({ total: 3, operations: { 'authorization:users:find': 2, 'application:other:getMore': 1 } });
    expect(counter.mock.calls.map(([labels]) => labels.outcome)).toEqual(['error', 'success', 'success']);
    expect(latency.mock.calls).toHaveLength(2);
    expect(latency.mock.calls[0][1]).toBe(0.025);
    expect(JSON.stringify(counter.mock.calls)).not.toContain('private');
    expect(JSON.stringify(counter.mock.calls)).not.toContain('secret');
  } finally { counter.mockRestore(); latency.mockRestore(); }
});
