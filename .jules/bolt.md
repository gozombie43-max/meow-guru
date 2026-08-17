## 2024-05-18 - MathRenderer optimization
**Learning:** Parsing strings and executing `katex.renderToString` on every render causes significant main thread blocking, specifically because quiz option updates trigger re-renders that re-evaluate all formulas. `React.memo` effectively caches the complex string parsing and rendering per distinct text input.
**Action:** Always verify memoization strategies around third-party, CPU-heavy DOM manipulation libraries like `katex`, particularly when integrated into rapidly changing state structures like quiz selections.
