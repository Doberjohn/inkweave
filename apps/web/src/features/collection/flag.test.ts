import {afterEach, describe, it, expect, vi} from 'vitest';

/** The flag is read once at module load, so each case imports a fresh copy. */
async function showCollection(env: {collection?: string; accounts?: string}) {
  vi.stubEnv('VITE_SHOW_COLLECTION', env.collection ?? '');
  vi.stubEnv('VITE_SHOW_ACCOUNTS', env.accounts ?? '');
  vi.resetModules();
  return (await import('./flag')).SHOW_COLLECTION;
}

describe('SHOW_COLLECTION', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is on only when both the collection and the accounts flags are on', async () => {
    expect(await showCollection({collection: 'true', accounts: 'true'})).toBe(true);
  });

  it('stays off with accounts off, so the sign-in gate cannot expose sign-in', async () => {
    expect(await showCollection({collection: 'true', accounts: 'false'})).toBe(false);
  });

  it('is off by default', async () => {
    expect(await showCollection({})).toBe(false);
  });
});
