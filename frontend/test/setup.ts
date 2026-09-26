import * as matchers from "@testing-library/jest-dom/matchers";
import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import { afterEach, vi, beforeAll, afterAll, expect } from "vitest";
import { cleanup } from "@testing-library/react";

// Register against this workspace's Vitest instance. The jest-dom /vitest entry
// assumes Vitest is hoisted beside it, and uses the pre-v5 assertion types.
expect.extend(matchers);
declare module "vitest" {
  // Declaration merging requires an interface to add the jest-dom matchers.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R extends void | Promise<void> = void | Promise<void>> extends TestingLibraryMatchers<unknown, R> {}
}

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
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
