import {describe, it, expect} from 'vitest';
import {getAllPlaystyles} from 'inkweave-synergy-engine';
import {PLAYSTYLE_UI} from '../playstyleUi';

// PLAYSTYLE_UI is exhaustive over PlaystyleId, so tsc forces an entry for every id. The engine's
// playstyle registry is built from tuning.json's keys, a Record<string, …> that tsc cannot check:
// a PlaystyleId with no tuning.json entry compiles cleanly and silently drops out of the gallery,
// the sitemap and prerender. This keeps the two lists in lockstep.
describe('playstyle registry parity', () => {
  it('registers every PLAYSTYLE_UI playstyle in the engine, and no others', () => {
    const uiIds = Object.keys(PLAYSTYLE_UI).sort();
    const engineIds = getAllPlaystyles()
      .map((p) => p.id)
      .sort();
    expect(engineIds).toEqual(uiIds);
  });
});
