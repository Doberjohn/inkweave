import {describe, it, expect} from 'vitest';
import {
  deriveHash,
  hashedFilename,
  indexById,
  planFor,
  sourceHash,
  verifyRestored,
} from '../imageRestore.mjs';

const CDN = 'https://api.lorcana.ravensburger.com/images/en/set9';
const SRC = 'f713db8c34028061e24b4dc3933965b143dcff56';
const OTHER_SRC = 'a'.repeat(40);

function card(over = {}) {
  return {id: 1936, images: {full: `${CDN}/1_${SRC}.jpg`}, ...over};
}
function deployed(over = {}) {
  return {...card(), imageHash: 'ffff000011112222', imageHashSm: 'aaaa333344445555', ...over};
}

describe('sourceHash', () => {
  it('extracts the 40-hex tail Ravensburger content-addresses its images with', () => {
    expect(sourceHash(card())).toBe(SRC);
  });

  it('returns null when the URL is not content-addressed, rather than guessing', () => {
    expect(sourceHash(card({images: {full: 'https://example.com/plain.jpg'}}))).toBeNull();
    expect(sourceHash(card({images: {}}))).toBeNull();
    expect(sourceHash(undefined)).toBeNull();
  });

  it('rejects a tail of the wrong length, so a near-miss cannot pass as a hash', () => {
    expect(sourceHash(card({images: {full: `${CDN}/1_abc123.jpg`}}))).toBeNull();
  });
});

describe('planFor', () => {
  it('restores when prod serves the same source art and publishes both hashes', () => {
    expect(planFor(card(), deployed())).toEqual({
      action: 'restore',
      full: 'ffff000011112222',
      sm: 'aaaa333344445555',
    });
  });

  it('downloads when prod has never seen the card', () => {
    expect(planFor(card(), undefined).action).toBe('download');
  });

  it('downloads when the upstream art changed — the whole point of comparing source', () => {
    expect(planFor(card(), deployed({images: {full: `${CDN}/1_${OTHER_SRC}.jpg`}})).action).toBe('download');
  });

  it('downloads when prod publishes only one size, never mixing builds within a card', () => {
    expect(planFor(card(), deployed({imageHashSm: undefined})).action).toBe('download');
    expect(planFor(card(), deployed({imageHash: undefined})).action).toBe('download');
  });

  it('downloads when the local card has no extractable source hash', () => {
    expect(planFor(card({images: {full: 'https://example.com/x.jpg'}}), deployed()).action).toBe('download');
  });
});

describe('indexById', () => {
  it('keys on strings, so a numeric id still finds a string-keyed entry', () => {
    const index = indexById([{id: 1936}]);
    expect(index.get(String(1936))).toEqual({id: 1936});
  });

  it('tolerates absent input rather than throwing when prod is unreachable', () => {
    expect(indexById(null).size).toBe(0);
  });
});

describe('verifyRestored', () => {
  const bytes = Buffer.from('some avif bytes');
  /*
    A KNOWN ANSWER, not deriveHash's own output. Asserting against deriveHash would only
    prove internal consistency: a degenerate implementation returning a constant, or the
    wrong digest length, would satisfy every other test here including the mismatch one,
    while breaking both the byte-verification guarantee and the 16-hex filename contract
    the loader's URLs are built on. This literal is sha256('some avif bytes') truncated
    to 16 hex, so changing the hash function fails the test rather than moving with it.
  */
  const KNOWN_HASH = 'ebc887b3eb0ae89e';

  it('derives the documented sha256-prefix hash, pinned to a known answer', () => {
    expect(deriveHash(bytes)).toBe(KNOWN_HASH);
    expect(KNOWN_HASH).toHaveLength(16);
  });

  it('accepts bytes that hash to what was asked for', () => {
    expect(verifyRestored(bytes, KNOWN_HASH)).toBe(true);
  });

  it('REJECTS bytes that do not, which is what makes fetching build inputs safe', () => {
    expect(verifyRestored(bytes, 'deadbeefdeadbeef')).toBe(false);
  });

  it('rejects empty or absent bytes rather than hashing nothing into a match', () => {
    expect(verifyRestored(Buffer.alloc(0), deriveHash(Buffer.alloc(0)))).toBe(false);
    expect(verifyRestored(null, 'whatever')).toBe(false);
  });
});

describe('hashedFilename', () => {
  it('keeps the -sm segment the web loader reconstructs', () => {
    expect(hashedFilename(1936, 'abcd', '')).toBe('1936.abcd.avif');
    expect(hashedFilename(1936, 'abcd', '-sm')).toBe('1936.abcd-sm.avif');
  });
});
