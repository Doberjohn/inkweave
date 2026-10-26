import {describe, it, expect} from 'vitest';
import {BROWSE_SORT_OPTIONS, SYNERGY_SORT_OPTIONS} from '../appConstants';

// The app's sort options, which SortSelect lists, moved here from SortSelect's own test when
// SortSelect moved into inkweave-ui (#978); the describe keeps the test's full name.
describe('SortSelect', () => {
  // An <option> can't hide part of its text, so an arrow in a label is read aloud ("right arrow").
  it('words every app sort option without arrows, on phones too', () => {
    const labels = [...BROWSE_SORT_OPTIONS, ...SYNERGY_SORT_OPTIONS].flatMap((o) => [o.label, o.mobileLabel ?? '']);
    for (const label of labels) expect(label).not.toMatch(/[←→↑↓]/);
  });
});
