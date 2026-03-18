// Auto-detect Chrome on Windows (D: drive install)
if (!process.env.CHROME_PATH && !process.env.CI) {
  const winPaths = [
    'D:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of winPaths) {
    try {
      require('fs').accessSync(p);
      process.env.CHROME_PATH = p;
      break;
    } catch {}
  }
}

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx serve apps/web/dist -l 8080 -s',
      startServerReadyPattern: 'Accepting connections',
      url: [
        'http://localhost:8080/',
        'http://localhost:8080/browse',
        'http://localhost:8080/card/957',
        'http://localhost:8080/card/957/synergies',
        'http://localhost:8080/playstyles',
        'http://localhost:8080/playstyles/lore-denial',
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      assertions: {
        // Aggregate scores — error blocks merge, warn is informational
        'categories:performance': ['error', {minScore: 0.55}],
        'categories:accessibility': ['error', {minScore: 0.9}],
        'categories:seo': ['warn', {minScore: 0.9}],
        'categories:best-practices': ['warn', {minScore: 0.9}],

        // Core Web Vitals — CI headroom (+20%) over Google's "good" thresholds
        'largest-contentful-paint': ['warn', {maxNumericValue: 3000}],
        'cumulative-layout-shift': ['error', {maxNumericValue: 0.1}],
        'total-blocking-time': ['error', {maxNumericValue: 500}],
        'first-contentful-paint': ['warn', {maxNumericValue: 2200}],
        'speed-index': ['warn', {maxNumericValue: 4000}],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
