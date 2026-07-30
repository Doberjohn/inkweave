import {describe, it, expect} from 'vitest';
import {computePhase} from '../useRevealPhase';

const prerelease = new Date(2026, 4, 8, 0, 0, 0, 0); // 2026-05-08 local midnight
const release = new Date(2026, 4, 15, 0, 0, 0, 0); // 2026-05-15 local midnight
// `name` is required on RevealDates, but computePhase ignores it.
const dates = {prereleaseDate: prerelease, releaseDate: release, name: 'Test Set'};

describe('computePhase', () => {
  it('returns hidden when flag is disabled', () => {
    expect(computePhase(new Date(2026, 4, 10), dates, false)).toBe('hidden');
  });

  it('returns loading when flag is on but dates have not loaded yet', () => {
    expect(computePhase(new Date(2026, 4, 10), null, true)).toBe('loading');
  });

  it('returns pre-release before the pre-release date', () => {
    expect(computePhase(new Date(2026, 4, 7, 23, 59), dates, true)).toBe('pre-release');
  });

  it('returns pre-release-live at the pre-release boundary (inclusive)', () => {
    expect(computePhase(prerelease, dates, true)).toBe('pre-release-live');
  });

  it('returns pre-release-live between the two boundaries', () => {
    expect(computePhase(new Date(2026, 4, 10, 12), dates, true)).toBe('pre-release-live');
  });

  it('returns released at the release boundary (inclusive)', () => {
    expect(computePhase(release, dates, true)).toBe('released');
  });

  it('returns released after the release date', () => {
    expect(computePhase(new Date(2026, 4, 20), dates, true)).toBe('released');
  });
});
