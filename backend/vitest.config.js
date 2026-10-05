import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  testTimeout: 10000,
  setupFiles: ['./test/setup.js'],
  coverage: {
    provider: 'v8', reporter: ['text', 'json-summary', 'lcov'],
    include: ['auth/**/*.js', 'services/**/*.js', 'ai/**/*.js', 'repositories/**/*.js', 'config/environment.js'],
    exclude: ['**/__tests__/**'],
    thresholds: { 
      lines: 76, statements: 73, functions: 68, branches: 64,
      'config/environment.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'services/tutorPolicy.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'services/uploads/validatedImage.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'services/uploads/tutorAttachment.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'services/processTutorAttachmentJob.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'auth/jwt.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'auth/requestOrigin.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'auth/sessions.js': { lines: 90, statements: 90, functions: 90, branches: 90 },
      'services/questions/questionWriteService.js': { lines: 90, statements: 90, functions: 90, branches: 65 }
    },
  },
} });
