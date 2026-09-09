module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start -- --port 3100',
      url: ['http://localhost:3100/login', 'http://localhost:3100/mathematics'],
      numberOfRuns: 3,
      puppeteerScript: "./scripts/lighthouse-setup.cjs",
      puppeteerLaunchOptions: {
        headless: true,
        args: [
          '--headless=new',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-crash-reporter',
          '--disable-breakpad',
          '--window-size=1350,940',
        ],
      },
      settings: {
        preset: 'desktop',
        blockedUrlPatterns: ['*/backend-api/*'],
      },
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
