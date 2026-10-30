import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDistServer, readSiteHeaders, resolveDistFile, siteHeaders} from './serve-dist.mjs';

let base;
let dist;

/**
 * A crawled build in miniature: the home page's capture, two routes' captures and one asset,
 * beside a file outside it that no request may reach.
 */
beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-dist-'));
  dist = path.join(base, 'dist');
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(base, rel)), {recursive: true});
    fs.writeFileSync(path.join(base, rel), text);
  };
  write('dist/index.html', '<div id="root" data-prerender-route="/">home</div>');
  write('dist/browse/index.html', '<div id="root" data-prerender-route="/browse">browse</div>');
  write('dist/card/1989/elsa-snow-queen/index.html', '<div id="root">elsa</div>');
  write('dist/assets/index-abc.js', 'export {};');
  write('secret.txt', 'not served');
});

afterAll(() => {
  fs.rmSync(base, {recursive: true, force: true});
});

describe('resolveDistFile', () => {
  const served = (url) => resolveDistFile(dist, url);

  it('serves a route its own capture, with or without a trailing slash', () => {
    expect(served('/browse')).toBe(path.join(dist, 'browse', 'index.html'));
    expect(served('/browse/')).toBe(path.join(dist, 'browse', 'index.html'));
    expect(served('/card/1989/elsa-snow-queen')).toBe(
      path.join(dist, 'card/1989/elsa-snow-queen/index.html'),
    );
  });

  it("serves / the home page's capture", () => {
    expect(served('/')).toBe(path.join(dist, 'index.html'));
  });

  it("serves the home page's capture for a route without one, as vercel.json's rewrite does", () => {
    // The captures #915's inline script must empty: a compare link, or a card page by its id alone.
    expect(served('/compare/1989/1990')).toBe(path.join(dist, 'index.html'));
    expect(served('/card/1989')).toBe(path.join(dist, 'index.html'));
  });

  it('serves a file by its path, and a 404 for a path with a dot that names no file', () => {
    expect(served('/assets/index-abc.js')).toBe(path.join(dist, 'assets', 'index-abc.js'));
    expect(served('/assets/index-gone.js')).toBeUndefined();
  });

  it('ignores the query string', () => {
    expect(served('/browse?q=elsa')).toBe(path.join(dist, 'browse', 'index.html'));
  });

  it('serves nothing outside dist, nor for a malformed escape', () => {
    expect(served('/..%2fsecret.txt')).toBeUndefined();
    expect(served('/%E0%A4%A.js')).toBeUndefined();
  });
});

describe('siteHeaders', () => {
  it("takes the headers vercel.json gives every path, leaving out one host's and one path's", () => {
    const config = {
      headers: [
        {source: '/assets/(.*)', headers: [{key: 'Cache-Control', value: 'immutable'}]},
        {source: '/(.*)', headers: [{key: 'X-Frame-Options', value: 'DENY'}]},
        {
          source: '/(.*)',
          has: [{type: 'host', value: 'staging.inkweave.ink'}],
          headers: [{key: 'X-Robots-Tag', value: 'noindex'}],
        },
      ],
    };
    expect(siteHeaders(config)).toEqual({'X-Frame-Options': 'DENY'});
  });

  it("sends a CSP that lets index.html's inline route check run (#915)", () => {
    // Blocked, the check would never approve a prerendered page, which would then stay hidden
    // until the app's own script removed its mark.
    const csp = readSiteHeaders()['Content-Security-Policy'];
    const scriptSrc = csp
      .split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('script-src '));
    expect(scriptSrc.split(' ')).toContain("'unsafe-inline'");
  });

  it('sends other pages only the origin as the referrer, so a binder address never leaves its page', () => {
    expect(readSiteHeaders()['Referrer-Policy']).toBe('strict-origin');
  });
});

describe('createDistServer', () => {
  it("answers a route without a capture with the home page's, under the site's headers", async () => {
    const server = createDistServer(dist, {headers: {'X-Frame-Options': 'DENY'}});
    await new Promise((done) => server.listen(0, done));
    try {
      const base = `http://localhost:${server.address().port}`;
      const page = await fetch(`${base}/compare/1989/1990`);
      expect(page.status).toBe(200);
      expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(page.headers.get('x-frame-options')).toBe('DENY');
      expect(await page.text()).toContain('data-prerender-route="/"');
      expect((await fetch(`${base}/assets/index-gone.js`)).status).toBe(404);
    } finally {
      server.close();
    }
  });

  it('answers 500 for a file it cannot read, and keeps serving', async () => {
    // A rebuild empties dist under a running server: the rewrite names an index.html that is gone.
    const emptied = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-dist-emptied-'));
    const server = createDistServer(emptied, {headers: {}});
    await new Promise((done) => server.listen(0, done));
    try {
      const base = `http://localhost:${server.address().port}`;
      expect((await fetch(`${base}/compare/1989/1990`)).status).toBe(500);
      expect((await fetch(`${base}/browse`)).status).toBe(500);
    } finally {
      server.close();
      fs.rmSync(emptied, {recursive: true, force: true});
    }
  });

  it('hands each page to sendPage with its URL, and sends any other file whole', async () => {
    const urls = [];
    const sendPage = (res, body, url) => {
      urls.push(url);
      res.end(`${body}<!-- sent by sendPage -->`);
    };
    const server = createDistServer(dist, {headers: {}, sendPage});
    await new Promise((done) => server.listen(0, done));
    try {
      const base = `http://localhost:${server.address().port}`;
      expect(await (await fetch(`${base}/browse?q=elsa`)).text()).toBe(
        '<div id="root" data-prerender-route="/browse">browse</div><!-- sent by sendPage -->',
      );
      expect(await (await fetch(`${base}/assets/index-abc.js`)).text()).toBe('export {};');
      expect(urls).toEqual(['/browse?q=elsa']);
    } finally {
      server.close();
    }
  });

  // scripts/check-sw-update.mjs serves two deploys of one build this way.
  it("answers with bodyFor's body, or with the file's own where it gives none", async () => {
    const bodyFor = async (file, url) =>
      url === '/browse' ? `${path.relative(dist, file)}, swapped` : undefined;
    const server = createDistServer(dist, {headers: {}, bodyFor});
    await new Promise((done) => server.listen(0, done));
    try {
      const base = `http://localhost:${server.address().port}`;
      const page = await fetch(`${base}/browse`);
      expect(page.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(await page.text()).toBe(`${path.join('browse', 'index.html')}, swapped`);
      expect(await (await fetch(`${base}/assets/index-abc.js`)).text()).toBe('export {};');
    } finally {
      server.close();
    }
  });
});
