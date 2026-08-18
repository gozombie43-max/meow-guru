import { describe, it, expect } from 'vitest';
import { normalizeSearchKey } from '../questionController.js';

describe('questionController - normalizeSearchKey', () => {
  it('should trim and lowercase standard strings', () => {
    expect(normalizeSearchKey('  Hello World  ')).toBe('helloworld');
  });

  it('should remove punctuation and special characters', () => {
    expect(normalizeSearchKey('Hello, World! 123 @#$')).toBe('helloworld123');
  });

  it('should handle empty strings', () => {
    expect(normalizeSearchKey('')).toBe('');
    expect(normalizeSearchKey('   ')).toBe('');
  });

  it('should handle null or undefined gracefully', () => {
    expect(normalizeSearchKey(null)).toBe('');
    expect(normalizeSearchKey(undefined)).toBe('');
  });

  it('should handle numbers correctly', () => {
    expect(normalizeSearchKey(12345)).toBe('12345');
    expect(normalizeSearchKey('123.45')).toBe('12345');
  });

  it('should handle mixed alphanumeric cases', () => {
    expect(normalizeSearchKey('MATH 101 - Intro to Algebra!')).toBe('math101introtoalgebra');
  });
});
