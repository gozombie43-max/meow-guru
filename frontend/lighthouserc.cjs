module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node scripts/start-performance-fixture.mjs',
      puppeteerScript: './scripts/lighthouse-setup.cjs',
      puppeteerLaunchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-features=CalculateNativeWinOcclusion', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] },
      url: ['/login', '/mathematics', '/play', '/play/session/lighthouse-training', '/mathematics/advance/algebra/quiz?resume=1', '/mock-test/ssc-cgl/browser-test/attempt'].map(path => `http://127.0.0.1:3100${path}`),
      numberOfRuns: 3,
      settings: {
        // Lighthouse's default mobile emulation and simulated throttling.
        formFactor: 'mobile',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9, aggregationMethod: 'median' }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
        'total-blocking-time': ['warn', { maxNumericValue: 200, aggregationMethod: 'median' }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.next/diagnostics/lighthouse' },
  },
};
