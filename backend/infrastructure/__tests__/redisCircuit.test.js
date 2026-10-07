import { expect, it } from 'vitest';
import { createRedisCircuit } from '../redisCircuit.js';

it('opens after five recent failures, admits one recovery probe and closes on recovery', () => {
  let now = 0;
  const circuit = createRedisCircuit({ now: () => now });
  for (let i = 0; i < 4; i++) circuit.failure();
  expect(circuit.admit()).toBe('normal');
  circuit.failure(); expect(circuit.state()).toBe('open');
  expect(circuit.admit()).toBe('skip');
  now = 15001;
  expect(circuit.admit()).toBe('probe');
  expect(circuit.admit()).toBe('skip');
  circuit.recovered();
  expect(circuit.state()).toBe('closed'); expect(circuit.admit()).toBe('normal');
});

it('forgets old failures and backs off again when the recovery probe fails', () => {
  let now = 0;
  const circuit = createRedisCircuit({ now: () => now });
  for (let i = 0; i < 4; i++) circuit.failure();
  now = 10001; circuit.failure();
  expect(circuit.state()).toBe('closed');
  circuit.unavailable(); now += 15001;
  expect(circuit.admit()).toBe('probe');
  circuit.failure(); expect(circuit.admit()).toBe('skip');
});
