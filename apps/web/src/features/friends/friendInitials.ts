import type {Ink} from 'inkweave-synergy-engine';
import {ALL_INKS} from '../../shared/constants';

/** The first letter of each of the name's first two words: "Ruby Hero 042" is RH. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => (Array.from(word)[0] ?? '').toUpperCase())
    .join('');
}

/** The ink a handle starts with (`ruby_hero_042` is Ruby), or null. */
export function inkOfHandle(handle: string | null): Ink | null {
  const lower = handle?.toLowerCase() ?? '';
  return ALL_INKS.find((ink) => lower.startsWith(ink.toLowerCase())) ?? null;
}
