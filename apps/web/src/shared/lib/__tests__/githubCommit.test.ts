import {describe, it, expect, vi, afterEach} from 'vitest';
import {validateToken, utf8ToBase64, base64ToUtf8, commitFiles} from '../githubCommit';

afterEach(() => vi.restoreAllMocks());

describe('utf8 base64 round-trip', () => {
  it('survives the ink glyph', () => {
    const s = 'pay 1 ⬡ less to play this character.';
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s);
  });
});

describe('validateToken', () => {
  it('reports push access on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({permissions: {push: true}}), {status: 200}),
    );
    expect(await validateToken('tok')).toEqual({ok: true, canPush: true, error: undefined});
  });

  it('flags a token without push access', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({permissions: {push: false}}), {status: 200}),
    );
    const r = await validateToken('tok');
    expect(r.canPush).toBe(false);
    expect(r.error).toMatch(/write/i);
  });
});

describe('commitFiles', () => {
  it('creates a blob + tree per file and patches the ref', async () => {
    const calls: {url: string; method: string; body?: unknown}[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url);
      calls.push({url: u, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body as string) : undefined});
      if (u.endsWith('/git/ref/heads/master')) return new Response(JSON.stringify({object: {sha: 'basecommit'}}), {status: 200});
      if (u.includes('/git/commits/basecommit')) return new Response(JSON.stringify({tree: {sha: 'basetree'}}), {status: 200});
      if (u.endsWith('/git/blobs')) return new Response(JSON.stringify({sha: 'blobsha'}), {status: 201});
      if (u.endsWith('/git/trees')) return new Response(JSON.stringify({sha: 'newtree'}), {status: 201});
      if (u.endsWith('/git/commits')) return new Response(JSON.stringify({sha: 'newcommit', html_url: 'https://github.com/x/y/commit/newcommit'}), {status: 201});
      if (u.endsWith('/git/refs/heads/master')) return new Response(JSON.stringify({}), {status: 200});
      throw new Error(`unexpected url ${u}`);
    });

    const res = await commitFiles({
      token: 'tok',
      message: 'test commit',
      files: [{path: 'a/b.txt', contentBase64: 'Zm9v'}],
    });

    expect(res.commitUrl).toBe('https://github.com/x/y/commit/newcommit');
    const tree = calls.find((c) => c.url.endsWith('/git/trees'))!;
    expect(tree.body).toMatchObject({base_tree: 'basetree', tree: [{path: 'a/b.txt', mode: '100644', type: 'blob', sha: 'blobsha'}]});
    const patch = calls.find((c) => c.url.endsWith('/git/refs/heads/master'))!;
    expect(patch.method).toBe('PATCH');
    expect(patch.body).toMatchObject({sha: 'newcommit'});
  });
});
