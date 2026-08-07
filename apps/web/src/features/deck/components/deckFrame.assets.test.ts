import {describe, it, expect} from 'vitest';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {frameFor} from './deckFrame';
import type {Ink} from '../types';

/**
 * The frame path is DERIVED from the ink pair, and a wrong path fails silently: an
 * <img> with a bad src renders nothing, and the name and strip layered on top still
 * make it look like a card. Nothing in the type system or the unit tests can catch a
 * missing or misnamed asset, so this walks the filesystem instead.
 *
 * It is the guard that makes "adding a frame is a pure asset drop" safe to believe.
 */
const FRAMES_DIR = join(process.cwd(), 'public', 'art', 'frames');
const ALL: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

function everyLegalCombination(): Ink[][] {
  const combos: Ink[][] = ALL.map((ink) => [ink]);
  for (let i = 0; i < ALL.length; i++) {
    for (let j = i + 1; j < ALL.length; j++) combos.push([ALL[i], ALL[j]]);
  }
  return combos;
}

describe('frame assets', () => {
  it('has a file for every path frameFor can produce', () => {
    const missing = everyLegalCombination()
      .map((inks) => frameFor(inks))
      .filter((path): path is string => path !== null)
      .filter((path) => !existsSync(join(FRAMES_DIR, path.split('/').pop() as string)));
    expect(missing).toEqual([]);
  });

  it('ships no frame the code can never request', () => {
    // A stray or misnamed file is dead weight in the deploy and, worse, a decoy:
    // "steel-emerald.webp" looks present but is unreachable, because the path rule
    // sorts alphabetically.
    const reachable = new Set(
      everyLegalCombination()
        .map((inks) => frameFor(inks)?.split('/').pop())
        .filter(Boolean),
    );
    const onDisk = readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.webp'));
    expect(onDisk.filter((f) => !reachable.has(f))).toEqual([]);
  });

  it('ships only real WebP, at the one size the geometry assumes', () => {
    // Every measured constant in deckFrame.ts is a percentage of a 734x1024 bitmap.
    // A re-export at another size would leave the overlays subtly misplaced rather
    // than visibly broken, which is the kind of thing nobody notices for weeks.
    for (const file of readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.webp'))) {
      const buf = readFileSync(join(FRAMES_DIR, file));
      expect(buf.subarray(0, 4).toString('ascii'), `${file} RIFF header`).toBe('RIFF');
      expect(buf.subarray(8, 12).toString('ascii'), `${file} WEBP header`).toBe('WEBP');
      // Lossy VP8 stores width/height as 14-bit fields after the frame tag.
      expect(buf.subarray(12, 16).toString('ascii'), `${file} codec`).toBe('VP8 ');
      expect(
        [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff],
        `${file} dimensions`,
      ).toEqual([734, 1024]);
    }
  });
});
