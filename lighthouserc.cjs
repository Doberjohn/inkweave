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
