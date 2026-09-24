import vm from 'node:vm';
import {describe, it, expect} from 'vitest';
import {BROWSER_API_VERSION, installSnippet} from './browser.mjs';

describe('installSnippet', () => {
  it('is a self-contained expression that installs the API and reports its version', () => {
    // The snippet is pasted into a browser tab, so it may not lean on anything from this
    // module. Running it in a fresh context that holds only a stand-in window proves the
    // install step stands alone.
    const fakeWindow = {};
    expect(vm.runInNewContext(installSnippet(), {window: fakeWindow})).toBe(BROWSER_API_VERSION);
    expect(Object.keys(fakeWindow.__revealSync)).toEqual(['version', 'discover', 'fetchCards']);
  });

  it('maps every glyph image the site uses to the character the card data uses', () => {
    const snippet = installSnippet();
    for (const [alt, glyph] of [
      ['Ink', '⬡'],
      ['Lore', '◊'],
      ['Exert', '⟳'],
      ['Strength', '¤'],
      ['Willpower', '⛉'],
    ]) {
      expect(snippet).toContain(`${alt}: '${glyph}'`);
    }
  });
});
