import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {appRewrites, sourceToRegExp} from './lib/vercel-rewrites.mjs';

// vercel.json sends each route of the app to its shell, and Vercel answers every other path with
// 404.html and a 404. A route missing here would still render in a browser, from the 404 page, but
// under a 404 status a crawler drops it from the index.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const rewrites = appRewrites(JSON.parse(read('vercel.json')));
const rewritten = (url) => rewrites.some((source) => source.test(url));

/** Every `path:` in the router, each a child of `/`, as a URL with a value in each param. */
const routerPaths = [...read('apps/web/src/router.tsx').matchAll(/\bpath: '([^']+)'/g)]
  .map(([, route]) => route)
  .filter((route) => route !== '/' && route !== '*');
const sample = (route) => `/${route.replace(/:\w+/g, 'x1')}`;

const INKS = ['amber', 'amethyst', 'emerald', 'ruby', 'sapphire', 'steel'];

describe('vercel.json rewrites', () => {
  it('finds the routes in router.tsx', () => {
    expect(routerPaths).toContain('card/:cardId/:slug');
    expect(routerPaths.length).toBeGreaterThan(15);
  });

  it('sends every route in router.tsx to the app', () => {
    const missing = routerPaths
      .filter((route) => route !== 'ink/:inkSlug')
      .filter((route) => !rewritten(sample(route)));
    expect(missing).toEqual([]);
  });

  it('sends the six ink hubs to the app, and no other ink', () => {
    expect(INKS.filter((ink) => !rewritten(`/ink/${ink}`))).toEqual([]);
    expect(rewritten('/ink/purple')).toBe(false);
  });

  it('sends a path no route matches to the 404 page', () => {
    for (const url of [
      '/seo-check-missing',
      '/browse/extra',
      '/compare/1',
      '/vote/1',
      '/card/1/x/y',
    ]) {
      expect({url, rewritten: rewritten(url)}).toEqual({url, rewritten: false});
    }
  });

  it('matches a route with or without a trailing slash', () => {
    expect(rewritten('/browse/')).toBe(true);
    expect(rewritten('/card/1936/bruno-madrigal-undetected-uncle/')).toBe(true);
  });
});

describe('sourceToRegExp', () => {
  it('reads literal segments, params, param lists and a trailing star', () => {
    expect(sourceToRegExp('/card/:id').test('/card/1936')).toBe(true);
    expect(sourceToRegExp('/card/:id').test('/card/1936/x')).toBe(false);
    expect(sourceToRegExp('/:page(about|terms)').test('/terms')).toBe(true);
    expect(sourceToRegExp('/:page(about|terms)').test('/termsx')).toBe(false);
    expect(sourceToRegExp('/assets/:path*').test('/assets/a/b.js')).toBe(true);
    expect(sourceToRegExp('/release-notes').test('/release-notesx')).toBe(false);
  });
});
