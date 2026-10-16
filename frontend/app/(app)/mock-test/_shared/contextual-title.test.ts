import { expect, it } from 'vitest';
import { contextualTitle } from './contextual-title';

it('removes repeated leading exam and selected tier without losing paper identity', () => {
  expect(contextualTitle('SSC CGL Tier I — Full Mock Test 1', 'SSC CGL', 'Tier I')).toBe('Full Mock Test 1');
  expect(contextualTitle('SSC CGL Tier II — Full Mock Test 1', 'SSC CGL', 'Tier I')).toBe('Tier II — Full Mock Test 1');
  expect(contextualTitle('SSC CGL — 2024 Shift 2', 'SSC CGL', 'Tier I')).toBe('2024 Shift 2');
  expect(contextualTitle('Special SSC CGL Paper', 'SSC CGL', 'Tier I')).toBe('Special SSC CGL Paper');
  expect(contextualTitle('SSC CGL', 'SSC CGL', '')).toBe('SSC CGL');
});
