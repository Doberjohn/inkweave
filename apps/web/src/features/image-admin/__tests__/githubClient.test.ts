import {describe, it, expect, vi, afterEach} from 'vitest';
import {commitCardImage} from '../githubClient';

afterEach(() => vi.restoreAllMocks());

// Table-driven git-data API stub: [url matcher, JSON body, status]. Keeps the
// fetch mock branch-free (avoids the "complex method" gate on the test).
const GIT_ROUTES: [(u: string) => boolean, unknown, number][] = [
  [(u) => u.endsWith('/git/ref/heads/master'), {object: {sha: 'c0'}}, 200],
  [(u) => u.includes('/git/commits/c0'), {tree: {sha: 't0'}}, 200],
  [(u) => u.endsWith('/git/blobs'), {sha: 'b0'}, 201],
  [(u) => u.endsWith('/git/trees'), {sha: 't1'}, 201],
  [(u) => u.endsWith('/git/commits'), {sha: 'c1', html_url: 'https://gh/commit/c1'}, 201],
  [(u) => u.endsWith('/git/refs/heads/master'), {}, 200],
];

function gitStub(url: string): Response {
  const route = GIT_ROUTES.find(([match]) => match(url));
  if (!route) throw new Error(`unexpected ${url}`);
  return new Response(JSON.stringify(route[1]), {status: route[2]});
}

describe('commitCardImage', () => {
  it('commits one raw file to card-images-raw and no previewCards path', async () => {
    const bodies: unknown[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      if (init?.body) bodies.push(JSON.parse(init.body as string));
      return gitStub(String(url));
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
