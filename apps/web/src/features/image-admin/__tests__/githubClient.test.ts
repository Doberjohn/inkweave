import {describe, it, expect, vi, afterEach} from 'vitest';
import {commitCardImage} from '../githubClient';

afterEach(() => vi.restoreAllMocks());

describe('commitCardImage', () => {
  it('commits one raw file to card-images-raw and no previewCards path', async () => {
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url);
      if (init?.body) bodies.push(JSON.parse(init.body as string));
      if (u.endsWith('/git/ref/heads/master')) return new Response(JSON.stringify({object: {sha: 'c0'}}), {status: 200});
      if (u.includes('/git/commits/c0')) return new Response(JSON.stringify({tree: {sha: 't0'}}), {status: 200});
      if (u.endsWith('/git/blobs')) return new Response(JSON.stringify({sha: 'b0'}), {status: 201});
      if (u.endsWith('/git/trees')) return new Response(JSON.stringify({sha: 't1'}), {status: 201});
      if (u.endsWith('/git/commits')) return new Response(JSON.stringify({sha: 'c1', html_url: 'https://gh/commit/c1'}), {status: 201});
      if (u.endsWith('/git/refs/heads/master')) return new Response(JSON.stringify({}), {status: 200});
      throw new Error(`unexpected ${u}`);
    });

    const res = await commitCardImage({
      token: 'tok',
      card: {id: '5001', fullName: 'Elsa - Snow Queen'},
      imageBase64: 'data:image/png;base64,Zm9v',
      imageExt: 'png',
    });

    expect(res.commitUrl).toBe('https://gh/commit/c1');
    const tree = bodies.find((b) => b && (b as {tree?: unknown}).tree) as {tree: {path: string}[]};
    expect(tree.tree).toHaveLength(1);
    expect(tree.tree[0].path).toBe('apps/web/public/card-images-raw/5001.png');
    expect(JSON.stringify(bodies)).not.toContain('previewCards.json');
  });
});
