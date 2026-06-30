import {describe, it, expect, vi, afterEach} from 'vitest';
import {validateToken, utf8ToBase64, base64ToUtf8} from '../githubClient';

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
    const r = await validateToken('tok');
    expect(r).toEqual({ok: true, canPush: true, error: undefined});
  });

  it('flags a token without push access', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({permissions: {push: false}}), {status: 200}),
    );
    const r = await validateToken('tok');
    expect(r.ok).toBe(true);
    expect(r.canPush).toBe(false);
    expect(r.error).toMatch(/write/i);
  });

  it('reports an invalid token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', {status: 401}));
    const r = await validateToken('bad');
    expect(r).toEqual({ok: false, canPush: false, error: 'Invalid or expired token'});
  });
});
