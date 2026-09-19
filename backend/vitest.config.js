import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  coverage: {
    provider: 'v8', reporter: ['text', 'json-summary', 'lcov'],
    include: ['auth/**/*.js', 'services/**/*.js', 'ai/**/*.js', 'repositories/**/*.js'],
    exclude: ['**/__tests__/**'],
    thresholds: { 
      'auth/requestOrigin.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'auth/sessions.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'services/questions/questionWriteService.js': { lines: 90, statements: 90, functions: 90, branches: 90 }
    },
  },
} });
