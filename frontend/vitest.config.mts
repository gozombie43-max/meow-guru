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
      include: [
        "lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "features/**/*.{ts,tsx}", "shared/**/*.{ts,tsx}",
        // Vitest 5 applies include to imported modules too. Keep the shared app
        // modules measured by our previous coverage baseline in the report.
        "app/(app)/battle/_shared/BattleSection.tsx",
        "app/(app)/english/_shared/ComparisonWordIndex.tsx",
        "app/(app)/english/_shared/SpeakerBtn.tsx",
        "app/(app)/english/_shared/study-mode-comparison-model.ts",
        "app/(app)/english/_shared/useStudyModeComparisonController.ts",
        "app/(app)/english/_shared/useStudyModeEngine.ts",
        "app/(app)/english/_shared/useStudyModeTerms.ts",
        "app/(app)/mathematics/_shared/route-page.tsx",
        "app/(app)/mock-test/_shared/MockTestEngine.tsx",
      ],
      exclude: ["**/*.d.ts", "**/*.test.{ts,tsx}"],
    },
  },
});
