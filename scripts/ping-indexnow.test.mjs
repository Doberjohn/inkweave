import {describe, it, expect} from 'vitest';
import {buildPayload, findKey, HUB_URLS} from './ping-indexnow.mjs';

describe('ping-indexnow', () => {
  it('builds an apex-host payload with key + keyLocation', () => {
    const p = buildPayload(['https://inkweave.ink/', 'https://inkweave.ink/browse'], 'abc123');
    expect(p.host).toBe('inkweave.ink');
    expect(p.key).toBe('abc123');
    expect(p.keyLocation).toBe('https://inkweave.ink/abc123.txt');
    expect(p.urlList.every((u) => u.startsWith('https://inkweave.ink/'))).toBe(true);
  });

  it('hub URLs are all apex and include the homepage', () => {
    expect(HUB_URLS.every((u) => u.startsWith('https://inkweave.ink/'))).toBe(true);
    expect(HUB_URLS).toContain('https://inkweave.ink/');
  });

  it('finds the hosted key file, and it matches the file name (IndexNow convention)', () => {
    const key = findKey();
    expect(key).toMatch(/^[a-f0-9]{8,128}$/);
  });
});
