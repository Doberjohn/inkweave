import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import middleware, {config} from '../middleware.ts';

// #634: retired hosts must get a 200 self-unregistering worker at /sw.js (a redirect there is what
// strands www-era service workers), while every other retired-host path 308s to the apex.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const slugs = readJson('middleware-data/card-slugs.json');
const vercel = readJson('vercel.json');
const RETIRED_HOSTS = ['www.inkweave.ink', 'lorcana-synergy-finder.vercel.app'];

// Runs the served worker against stubbed service-worker globals and records every call it makes.
async function runRetirementWorker(body) {
  const calls = [];
  const listeners = {};
  const self = {
    addEventListener: (type, fn) => (listeners[type] = fn),
    skipWaiting: () => calls.push('skipWaiting'),
    clients: {
      claim: async () => calls.push('claim'),
      matchAll: async ({type}) => {
        calls.push(`matchAll ${type}`);
        const url = 'https://www.inkweave.ink/browse?q=1#f';
        return [{url, navigate: async (to) => calls.push(`navigate ${to}`)}];
      },
    },
    registration: {unregister: async () => calls.push('unregister')},
  };
  const caches = {
    keys: async () => ['workbox-precache-v2'],
    delete: async (key) => calls.push(`delete ${key}`),
  };
  vm.runInContext(body, vm.createContext({self, caches, URL, Promise}));
  listeners.install({});
  let activation;
  listeners.activate({waitUntil: (promise) => (activation = promise)});
  await activation;
  return calls;
}

describe('retired-host service worker', () => {
  it.each(RETIRED_HOSTS)('serves an uncached JavaScript worker on %s', (host) => {
    const res = middleware(new Request(`https://${host}/sw.js`));
    expect(res?.status).toBe(200);
    expect(res?.headers.get('content-type')).toMatch(/^text[/]javascript/);
    expect(res?.headers.get('cache-control')).toBe('no-store');
  });

  it('unregisters itself without touching the network', async () => {
    const body = await middleware(new Request('https://www.inkweave.ink/sw.js')).text();
    expect(body).toContain('registration.unregister()');
    expect(body).not.toContain("addEventListener('fetch'");
    expect(body).not.toContain('importScripts(');
    expect(body).not.toContain('fetch(');
    expect(() => new Function(body)).not.toThrow();
  });

  it('skips waiting, clears caches, unregisters, then moves tabs to the apex', async () => {
    const body = await middleware(new Request('https://www.inkweave.ink/sw.js')).text();
    expect(await runRetirementWorker(body)).toEqual([
      'skipWaiting',
      'claim',
      'delete workbox-precache-v2',
      'unregister',
      'matchAll window',
      'navigate https://inkweave.ink/browse?q=1#f',
    ]);
  });

  it.each(['WWW.INKWEAVE.INK', 'www.inkweave.ink:443', 'www.inkweave.ink.'])(
    'recognises a retired host from the Host header alone (%s)',
    (host) => {
      const request = new Request('https://inkweave-abc.vercel.app/sw.js', {headers: {host}});
      expect(middleware(request)?.status).toBe(200);
    },
  );

  it.each(['inkweave.ink', 'lorcana-synergy-finder-git-foo-team.vercel.app'])(
    'falls through to the real Workbox worker on %s',
    (host) => {
      expect(middleware(new Request(`https://${host}/sw.js`))).toBeUndefined();
    },
  );

  it('matches the service worker path alongside numeric cards', () => {
    expect(config.matcher).toEqual(['/card/:id', '/sw.js']);
  });
});

describe('numeric card redirect', () => {
  it('308s a known id to its slug URL and keeps the query', () => {
    const [id, slug] = Object.entries(slugs)[0];
    const res = middleware(new Request(`https://inkweave.ink/card/${id}?utm=x`));
    expect(res?.status).toBe(308);
    expect(res?.headers.get('location')).toBe(`/card/${id}/${slug}?utm=x`);
  });

  it('falls through for an unknown id', () => {
    expect(middleware(new Request('https://inkweave.ink/card/nope'))).toBeUndefined();
  });
});

describe('vercel.json retired-host redirects', () => {
  const hostRedirects = vercel.redirects.filter((r) => r.has?.some((h) => h.type === 'host'));

  it('lists one redirect per retired host, ahead of the path redirects', () => {
    expect(hostRedirects.map((r) => r.has[0].value).sort()).toEqual([...RETIRED_HOSTS].sort());
    expect(vercel.redirects.slice(0, hostRedirects.length)).toEqual(hostRedirects);
  });

  it('sends every path except /sw.js to the same path on the apex', () => {
    for (const r of hostRedirects) {
      const source = new RegExp('^' + r.source + '$');
      for (const p of ['/', '/browse', '/data/allCards.json', '/sw.js.map']) {
        expect(p.replace(source, r.destination)).toBe(`https://inkweave.ink${p}`);
      }
      expect(source.test('/sw.js')).toBe(false);
      expect(r.statusCode).toBe(308);
    }
  });
});
