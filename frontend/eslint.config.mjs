import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const [nextBase, ...nextVitalsRest] = nextVitals;
const accessibilityRules = Object.fromEntries(
  Object.keys(jsxA11y.flatConfigs.recommended.rules).map((rule) => [
    rule,
    "error",
  ]),
);

const eslintConfig = defineConfig([
  {
    ...nextBase,
    rules: {
      ...nextBase.rules,
      ...accessibilityRules,
    },
  },
  ...nextVitalsRest,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,mts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      // Deprecated and superseded by label-has-associated-control.
      "jsx-a11y/label-has-for": "off",
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        { handlers: ["onClick", "onKeyDown", "onKeyUp", "onKeyPress"] },
      ],
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-location-assign-relative-destination": "warn",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/purity": "error",
      "react-hooks/immutability": "error",
      "react-hooks/preserve-manual-memoization": "error",
      "react-hooks/globals": "error",
      "react-hooks/incompatible-library": "error",
      "prefer-const": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "test-results/**",
    "next-env.d.ts",
    "*.log",
  ]),
]);

export default eslintConfig;
