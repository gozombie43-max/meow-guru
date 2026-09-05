module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start -- --port 3100',
      url: ['http://localhost:3100/login', 'http://localhost:3100/mathematics'],
      numberOfRuns: 3,
      puppeteerScript: "./scripts/lighthouse-setup.cjs",
      settings: { preset: 'desktop', blockedUrlPatterns: ['*/backend-api/*'] },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.next/diagnostics/lighthouse' },
  },
};
