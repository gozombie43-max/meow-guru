import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'uploads/**', 'data/**'] },
  { files: ['**/*.js'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node }, rules: {
    'no-undef': 'error', 'no-unreachable': 'error', 'no-dupe-args': 'error',
    'no-dupe-keys': 'error', 'no-duplicate-case': 'error', 'valid-typeof': 'error',
    'constructor-super': 'error', 'no-unsafe-finally': 'error',
  } },
  { files: ['**/*.js'], ignores: ['scripts/**', 'migrations/**', '**/__tests__/**', '**/*.test.js'], rules: {
    'no-console': 'error',
  } },
];
