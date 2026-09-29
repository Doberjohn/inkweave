import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {HERO_LOGO_ANIMATED_SRC, HERO_LOGO_IMG} from '../heroLogo';

// The homepage paints the static logo, then swaps to the animated one after load (#639). The
// swap is invisible only while the static file is the animated file frozen on its first
// frame, so an edit to one file that is not mirrored in the other would make the logo jump.
const read = (src: string) =>
  fs
    .readFileSync(path.resolve(process.cwd(), 'public', src.slice(1)), 'utf8')
    .replace(/\r\n/g, '\n');

describe('hero logo files', () => {
  it('differ only by the rule that pauses every animation', () => {
    const staticSvg = read(HERO_LOGO_IMG.src);
    // The rule's explanatory comment, then the rule itself.
    const pauseRule = new RegExp(
      String.raw`\n  /\* logo-static\.svg \(#639\)[\s\S]*?\*/\n` +
        String.raw`  \.halo, \.ring-spin, \.orbit--a, \.orbit--b, \.mote \{\n` +
        String.raw`    animation-play-state: paused;\n  \}\n`,
    );

    expect(staticSvg).toMatch(pauseRule);
    expect(staticSvg.replace(pauseRule, '')).toBe(read(HERO_LOGO_ANIMATED_SRC));
  });
});
