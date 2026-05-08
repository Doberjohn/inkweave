import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {PairScore} from '../lib/supabase';

// ── Number formatting ──

/** Formats a fraction (0..1) as a rounded percent. Null/undefined → "—". */
export function formatPercent(frac: number | null | undefined): string {
  if (frac == null) return '—';
  return `${Math.round(frac * 100)}%`;
}

/** Formats a numeric score to 1 decimal place. Null/undefined → "—". */
export function formatScore(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toFixed(1);
}

export interface ScoreDelta {
  arrow: '↑' | '↓' | null;
  value: string;
  tone: 'higher' | 'lower' | 'fair';
}

/**
 * Computes engine-vs-community delta. Tone: lower = community thinks engine is too high;
 * higher = community thinks engine is too low; fair = within ±0.05 or community null.
 */
export function formatDelta(engine: number, community: number | null | undefined): ScoreDelta {
  if (community == null) return {arrow: null, value: '—', tone: 'fair'};
  const diff = engine - community;
  if (Math.abs(diff) < 0.05) return {arrow: null, value: '0', tone: 'fair'};
  if (diff > 0) return {arrow: '↓', value: diff.toFixed(1), tone: 'lower'};
  return {arrow: '↑', value: Math.abs(diff).toFixed(1), tone: 'higher'};
}

// ── Driver category (carries argmax) ──

export type DriverCategory = 'solo-a' | 'solo-b' | 'duo' | 'spread';

/**
 * Picks the winning carries category. Returns null when there's no in-depth vote data.
 * Ties default to 'spread' (no clear driver — value is shared).
 */
export function pickDriver(score: PairScore | null): DriverCategory | null {
  if (!score) return null;
  const counts: {category: DriverCategory; count: number}[] = [
    {category: 'solo-a', count: score.carries_a ?? 0},
    {category: 'solo-b', count: score.carries_b ?? 0},
    {category: 'duo', count: score.carries_both ?? 0},
    {category: 'spread', count: score.carries_neither ?? 0},
  ];
  const max = Math.max(...counts.map((c) => c.count));
  if (max === 0) return null;
  const winners = counts.filter((c) => c.count === max);
  if (winners.length > 1) return 'spread';
  return winners[0].category;
}

// ── Dynamic copy ladders ──

export interface DynamicCopy {
  title: string;
  description: string;
}

interface Threshold {
  min: number;
  copy: DynamicCopy;
}

const REAL_LADDER: Threshold[] = [
  {min: 0.81, copy: {title: 'Real', description: 'Players agree this synergy actually plays out in decks'}},
  {min: 0.61, copy: {title: 'Probably real', description: 'Most players say this works in practice'}},
  {min: 0.41, copy: {title: 'Contested', description: 'Players are split on whether this plays out'}},
  {min: 0.21, copy: {title: 'Doubtful', description: 'Most players question whether this works in practice'}},
  {min: 0.0, copy: {title: 'Theoretical', description: "Players say this looks good on paper but doesn't fire"}},
];

const WOULD_PLAY_LADDER: Threshold[] = [
  {min: 0.81, copy: {title: 'Deck-worthy', description: 'Players would happily run these cards together'}},
  {min: 0.61, copy: {title: 'Worth running', description: 'Most players would slot these together'}},
  {min: 0.41, copy: {title: 'Situational', description: 'Players would consider it in the right deck'}},
  {min: 0.21, copy: {title: 'Niche', description: 'Few players would actually pair these'}},
  {min: 0.0, copy: {title: 'Skip it', description: "Players wouldn't run these together"}},
];

const DIFFICULTY_LADDER: Threshold[] = [
  {min: 2.34, copy: {title: 'Hard', description: 'Needs careful setup to fire'}},
  {min: 1.67, copy: {title: 'Situational', description: 'Takes some setup but reliable'}},
  {min: 0.0, copy: {title: 'Easy', description: 'Lands without much setup'}},
];

function pickFromLadder(value: number | null | undefined, ladder: Threshold[]): DynamicCopy | null {
  if (value == null) return null;
  for (const tier of ladder) {
    if (value >= tier.min) return tier.copy;
  }
  return null;
}

export function realCopy(frac: number | null | undefined): DynamicCopy | null {
  return pickFromLadder(frac, REAL_LADDER);
}

export function wouldPlayCopy(frac: number | null | undefined): DynamicCopy | null {
  return pickFromLadder(frac, WOULD_PLAY_LADDER);
}

export function difficultyCopy(value: number | null | undefined): DynamicCopy | null {
  return pickFromLadder(value, DIFFICULTY_LADDER);
}

// ── Driver copy (uses card names in description) ──

export interface DriverDisplay {
  value: string;
  description: string;
}

export function driverCopy(
  category: DriverCategory | null,
  cardA: LorcanaCard,
  cardB: LorcanaCard,
): DriverDisplay | null {
  if (!category) return null;
  switch (category) {
    case 'solo-a':
      return {value: 'Solo', description: `Players say ${cardA.fullName} drives this synergy`};
    case 'solo-b':
      return {value: 'Solo', description: `Players say ${cardB.fullName} drives this synergy`};
    case 'duo':
      return {value: 'Duo', description: 'Players say both cards drive this synergy equally'};
    case 'spread':
      return {
        value: 'Spread',
        description: 'Players say neither card alone drives this — value is shared',
      };
  }
}
