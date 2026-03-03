const baseUrl = (process.env.LHCI_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '');
const isLocal = !process.env.LHCI_BASE_URL;

const routes = ['/', '/browse', '/card/957', '/card/957/synergies'];

module.exports = {
  ci: {
    collect: {
      ...(isLocal && {
        startServerCommand: 'npx serve apps/web/dist -l 8080 -s',
        startServerReadyPattern: 'Accepting connections',
      }),
      url: routes.map((route) => `${baseUrl}${route}`),
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', {minScore: 0.9}],
        'categories:accessibility': ['warn', {minScore: 0.9}],
        'categories:seo': ['warn', {minScore: 0.9}],
        'categories:best-practices': ['warn', {minScore: 0.9}],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
