import {describe, it, expect} from 'vitest';
import {TUNING} from '../tuning';

const isIntInRange = (n: unknown, min: number, max: number) =>
  Number.isInteger(n) && (n as number) >= min && (n as number) <= max;

describe('tuning.json', () => {
  it('every playstyle has a non-empty name + tagline', () => {
    const entries = Object.values(TUNING.playstyles);
    expect(entries.length).toBeGreaterThan(0);
    for (const meta of entries) {
      expect(meta.name.trim()).not.toBe('');
      expect(meta.tagline.trim()).not.toBe('');
    }
  });

  it('every direct rule has a non-empty name + description', () => {
    for (const meta of Object.values(TUNING.directRules)) {
      expect(meta.name.trim()).not.toBe('');
      expect(meta.description.trim()).not.toBe('');
    }
  });

  it('shift tiers: score (when present) is an integer 1-10 and text is non-empty', () => {
    for (const entry of Object.values(TUNING.ruleTexts['shift-targets'])) {
      if (entry.score !== undefined) expect(isIntInRange(entry.score, 1, 10)).toBe(true);
      expect((entry.text ?? '').trim()).not.toBe('');
    }
  });

  it('ramp scores are integers 0-10 and every template is non-empty', () => {
    for (const s of Object.values(TUNING.ruleTexts.ramp.scores)) {
      expect(isIntInRange(s, 0, 10)).toBe(true);
    }
    for (const t of Object.values(TUNING.ruleTexts.ramp.templates)) {
      expect(t.trim()).not.toBe('');
    }
  });
});
