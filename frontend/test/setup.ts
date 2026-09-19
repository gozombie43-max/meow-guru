import "@testing-library/jest-dom/vitest";
import { afterEach, vi, beforeAll, afterAll } from "vitest";

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = args.join(' ');
    // Ignore known warnings that are unavoidable
    if (
      msg.includes('styled-jsx') ||
      msg.includes('non-boolean attribute')
    ) {
      return;
    }
    // Allow explicitly logged Error objects or specific strings from error tests
    if (
      args[0] instanceof Error ||
      msg.includes('Error:') ||
      msg.includes('Network unavailable') ||
      msg.includes('Another tab saved') ||
      msg.includes('Reload this attempt') ||
      msg.includes('Paper is unavailable')
    ) {
      originalConsoleError(...args);
      return;
    }
    originalConsoleError(...args);
    throw new Error(`Unexpected console.error: ${msg}`);
  };

  console.warn = (...args: unknown[]) => {
    const msg = args.join(' ');
    if (
      msg.includes('styled-jsx') ||
      msg.includes('non-boolean attribute')
    ) {
      return;
    }
    originalConsoleWarn(...args);
    throw new Error(`Unexpected console.warn: ${msg}`);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
