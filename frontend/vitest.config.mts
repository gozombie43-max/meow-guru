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
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/*.test.{ts,tsx}"],
    },
  },
});
