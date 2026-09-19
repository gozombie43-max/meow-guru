import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      thresholds: { "features/quiz/model/sessionReducer.ts": { lines: 90, statements: 90, functions: 90, branches: 90 } },
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "features/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/*.test.{ts,tsx}"],
    },
  },
});
