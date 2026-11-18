# Patched picomatch workspace (`@meow/picomatch`)

`picomatch <= 4.0.7` is affected by [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) (`CVE-2026-112366`), a Regular Expression Denial of Service (ReDoS) vulnerability in `analyzeRepeatedExtglob` (`lib/parse.js`) when parsing single-branch repeated extglobs containing wildcards (such as `+(*)` or `+(*a)`). The published advisory currently lists no patched npm version.

This workspace vendors `picomatch@4.0.7` and applies the upstream fix (`micromatch/picomatch#267`) in `lib/parse.js` to collapse simple absorbing single-branch wildcard extglobs and mark non-slash-delimited single-branch wildcard repeats as risky.

The root `package.json` anchors `"picomatch": "file:tools/picomatch"` in `devDependencies` and overrides `"picomatch": "$picomatch"`. Retire this override and workspace once upstream publishes a patched `picomatch` release to npm.
