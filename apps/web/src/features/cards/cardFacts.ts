import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SET_NAMES} from '../../shared/constants';

/** "a 6-cost", or "an 8-cost" and "an 11-cost", which a reader says with a vowel. */
function costPhrase(cost: number): string {
  const article = /^(8|11|18)/.test(String(cost)) ? 'an' : 'a';
  return `${article} ${cost}-cost`;
}

function inksPhrase(card: LorcanaCard): string {
  return card.ink2 ? `${card.ink} and ${card.ink2}` : card.ink;
}

/** "Action song" for a song, else the card's type. */
function typePhrase(card: LorcanaCard): string {
  return card.isSong ? 'Action song' : card.type;
}

/** The stats a card prints, as "5 strength, 7 willpower and 1 lore". */
function statsPhrase(card: LorcanaCard): string {
  const stats = [
    card.strength !== undefined && `${card.strength} strength`,
    card.willpower !== undefined && `${card.willpower} willpower`,
    card.lore !== undefined && card.lore > 0 && `${card.lore} lore`,
    card.moveCost !== undefined && `a move cost of ${card.moveCost}`,
  ].filter((s): s is string => Boolean(s));
  if (stats.length < 2) return stats.join('');
  return `${stats.slice(0, -1).join(', ')} and ${stats[stats.length - 1]}`;
}

function setPhrase(card: LorcanaCard): string {
  if (!card.setCode) return '';
  const set = SET_NAMES[card.setCode as keyof typeof SET_NAMES] ?? `Set ${card.setCode}`;
  return card.setNumber === undefined ? `from ${set}` : `from ${set}, card ${card.setNumber}`;
}

/**
 * One sentence of the card's printed facts, for its card page: its cost, ink, type,
 * classifications, stats, set and inkwell, which the page otherwise shows only in the card's
 * image. Built from the card's data, so it holds for every card.
 */
export function cardFacts(card: LorcanaCard): string {
  const classes = card.classifications?.length ? ` (${card.classifications.join(', ')})` : '';
  const stats = statsPhrase(card);
  const set = setPhrase(card);
  const parts = [
    `${card.fullName} is ${costPhrase(card.cost)} ${inksPhrase(card)} ${typePhrase(card)}${classes}`,
    stats && ` with ${stats}`,
    set && (stats ? `, ${set}` : ` ${set}`),
  ];
  const inkwell = card.inkwell ? 'It can go into the inkwell.' : 'It cannot go into the inkwell.';
  return `${parts.join('')}. ${inkwell}`;
}
