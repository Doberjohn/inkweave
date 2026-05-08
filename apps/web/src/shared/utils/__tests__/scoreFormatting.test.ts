import {describe, it, expect} from 'vitest';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {PairScore} from '../../lib/supabase';
import {
  formatPercent,
  formatScore,
  formatDelta,
  pickDriver,
  realCopy,
  wouldPlayCopy,
  difficultyCopy,
  driverCopy,
} from '../scoreFormatting';

const cardA = {fullName: 'Anna - Trusting Sister'} as LorcanaCard;
const cardB = {fullName: 'Elsa - Spirit of Winter'} as LorcanaCard;

const baseScore = (overrides: Partial<PairScore> = {}): PairScore =>
  ({
    card_a_id: 'a',
    card_b_id: 'b',
    total_votes: 10,
    score_votes: 5,
    accuracy_votes: 8,
    avg_score: 8.4,
    accuracy_sentiment: 0,
    accuracy_lower: 2,
    accuracy_right: 4,
    accuracy_higher: 2,
    pct_real: 0.8,
    pct_would_play: 0.7,
    carries_a: 0,
    carries_b: 0,
    carries_both: 0,
    carries_neither: 0,
    avg_difficulty: 2.0,
    ...overrides,
  } as PairScore);

describe('formatPercent', () => {
  it('returns em-dash for null/undefined', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
  });

  it('multiplies fraction by 100 and rounds', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.89)).toBe('89%');
    expect(formatPercent(0.495)).toBe('50%');
    expect(formatPercent(1)).toBe('100%');
  });
});

describe('formatScore', () => {
  it('returns em-dash for null/undefined', () => {
    expect(formatScore(null)).toBe('—');
    expect(formatScore(undefined)).toBe('—');
  });

  it('rounds to 1 decimal', () => {
    expect(formatScore(8.42)).toBe('8.4');
    expect(formatScore(8.49)).toBe('8.5');
    expect(formatScore(10)).toBe('10.0');
  });
});

describe('formatDelta', () => {
  it('returns fair tone with em-dash when community is null', () => {
    expect(formatDelta(9, null)).toEqual({arrow: null, value: '—', tone: 'fair'});
  });

  it('returns fair tone within ±0.05 of engine score', () => {
    expect(formatDelta(9, 9.04)).toEqual({arrow: null, value: '0', tone: 'fair'});
  });

  it('returns lower tone when community is below engine', () => {
    expect(formatDelta(9, 8.4)).toEqual({arrow: '↓', value: '0.6', tone: 'lower'});
  });

  it('returns higher tone when community is above engine', () => {
    expect(formatDelta(7, 8.2)).toEqual({arrow: '↑', value: '1.2', tone: 'higher'});
  });
});

describe('pickDriver', () => {
  it('returns null when score is null', () => {
    expect(pickDriver(null)).toBeNull();
  });

  it('returns null when all carries counts are zero', () => {
    expect(pickDriver(baseScore())).toBeNull();
  });

  it('picks solo-a when carries_a wins', () => {
    expect(pickDriver(baseScore({carries_a: 8, carries_b: 1, carries_both: 1}))).toBe('solo-a');
  });

  it('picks solo-b when carries_b wins', () => {
    expect(pickDriver(baseScore({carries_a: 1, carries_b: 8, carries_both: 1}))).toBe('solo-b');
  });

  it('picks duo when carries_both wins', () => {
    expect(pickDriver(baseScore({carries_a: 1, carries_b: 1, carries_both: 6}))).toBe('duo');
  });

  it('picks spread when carries_neither wins', () => {
    expect(pickDriver(baseScore({carries_neither: 5}))).toBe('spread');
  });

  it('returns spread on a tie', () => {
    expect(pickDriver(baseScore({carries_a: 4, carries_b: 4, carries_neither: 1}))).toBe('spread');
  });
});

describe('realCopy ladder', () => {
  it('returns null for null input', () => {
    expect(realCopy(null)).toBeNull();
  });

  it('picks Real at 0.81 boundary', () => {
    expect(realCopy(0.81)?.title).toBe('Real');
    expect(realCopy(0.8)?.title).toBe('Probably real');
  });

  it('picks Theoretical at 0', () => {
    expect(realCopy(0)?.title).toBe('Theoretical');
  });
});

describe('wouldPlayCopy ladder', () => {
  it('uses Situational for the middle range', () => {
    expect(wouldPlayCopy(0.5)?.title).toBe('Situational');
  });
});

describe('difficultyCopy ladder (3 tiers, 1.00–3.00 range)', () => {
  it('picks Easy below 1.67', () => {
    expect(difficultyCopy(1.5)?.title).toBe('Easy');
  });

  it('picks Situational from 1.67 to below 2.34', () => {
    expect(difficultyCopy(2.0)?.title).toBe('Situational');
    expect(difficultyCopy(1.67)?.title).toBe('Situational');
  });

  it('picks Hard at 2.34 and above', () => {
    expect(difficultyCopy(2.34)?.title).toBe('Hard');
    expect(difficultyCopy(3)?.title).toBe('Hard');
  });
});

describe('driverCopy', () => {
  it('returns null for null category', () => {
    expect(driverCopy(null, cardA, cardB)).toBeNull();
  });

  it('Solo with cardA full name when solo-a', () => {
    const result = driverCopy('solo-a', cardA, cardB);
    expect(result?.value).toBe('Solo');
    expect(result?.description).toContain('Anna - Trusting Sister');
  });

  it('Solo with cardB full name when solo-b', () => {
    const result = driverCopy('solo-b', cardA, cardB);
    expect(result?.value).toBe('Solo');
    expect(result?.description).toContain('Elsa - Spirit of Winter');
  });

  it('Duo when both cards drive', () => {
    expect(driverCopy('duo', cardA, cardB)?.value).toBe('Duo');
  });

  it('Spread when neither/tied', () => {
    expect(driverCopy('spread', cardA, cardB)?.value).toBe('Spread');
  });
});
