import {describe, it, expect} from 'vitest';
import {applyTuningEdits} from '../githubClient';

describe('applyTuningEdits', () => {
  it('applies a nested score edit without touching sibling fields', () => {
    const before = JSON.stringify(
      {ruleTexts: {'shift-targets': {'curve.gap3': {score: 5, text: 'Wide'}, 'curve.gap0': {score: 5, text: 'Same'}}}},
      null,
      2,
    );
    const after = applyTuningEdits(before, [
      {path: ['ruleTexts', 'shift-targets', 'curve.gap3', 'score'], value: 6},
    ]);
    const parsed = JSON.parse(after);
    expect(parsed.ruleTexts['shift-targets']['curve.gap3']).toEqual({score: 6, text: 'Wide'});
    expect(parsed.ruleTexts['shift-targets']['curve.gap0']).toEqual({score: 5, text: 'Same'});
  });

  it('applies multiple edits and ends with a trailing newline', () => {
    const before = JSON.stringify({playstyles: {ramp: {name: 'Ramp', tagline: 'x'}}}, null, 2);
    const after = applyTuningEdits(before, [
      {path: ['playstyles', 'ramp', 'name'], value: 'Ramp!'},
      {path: ['playstyles', 'ramp', 'tagline'], value: 'faster'},
    ]);
    expect(after.endsWith('\n')).toBe(true);
    expect(JSON.parse(after).playstyles.ramp).toEqual({name: 'Ramp!', tagline: 'faster'});
  });
});
