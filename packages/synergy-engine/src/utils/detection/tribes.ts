import type {LorcanaCard} from '../../types';
import {hasClassification, normalizeCardText} from '../cardHelpers.js';

// ============================================
// TRIBAL PLAYSTYLES (Monster, Princess, Hero, Super, Royalty, Detective, Gargoyle, Madrigal, Villain) — shared detector
// ============================================

/**
 * Generic tribal roles, reused across every classification tribe. All ids already
 * exist in the mechanics catalog (buff/trigger/search/in-play-check from
 * Location/Floodborn/Hunny, member is membership), so no new tile labels are needed.
 */
export type TribalRole = 'member' | 'buff' | 'trigger' | 'search' | 'in-play-check';

/** A tribal playstyle: which classification(s) make a member, and the word(s) its payoffs name. */
export interface TribalSpec {
  playstyleId: string;
  /** Classifications that make a card a member. */
  memberClasses: readonly string[];
  /** Words payoffs use to name the tribe (usually the classes; Royalty spans Queen/King/Prince). */
  refWords: readonly string[];
}

/** The nine tribal specs. Royalty deliberately excludes Princess so it complements the Princess rule. */
export const TRIBAL_SPECS = {
  monster: {playstyleId: 'monster', memberClasses: ['Monster'], refWords: ['Monster']},
  princess: {playstyleId: 'princess', memberClasses: ['Princess'], refWords: ['Princess']},
  hero: {playstyleId: 'hero', memberClasses: ['Hero'], refWords: ['Hero']},
  super: {playstyleId: 'super', memberClasses: ['Super'], refWords: ['Super']},
  royalty: {playstyleId: 'royalty', memberClasses: ['Queen', 'King', 'Prince'], refWords: ['Queen', 'King', 'Prince']},
  // Detectives — the Set 10 (Zootopia / Great Mouse Detective) tribe. 39 members, 8
  // pattern-caught payoffs (all Set 10, Sapphire/Steel-heavy). Drop-in over the shared
  // factory: reuses member/buff/trigger/search/in-play-check, no new roles.
  detective: {playstyleId: 'detective', memberClasses: ['Detective'], refWords: ['Detective']},
  // Gargoyles — the Sets 10-11 clan plus four Set 14 cards. 16 members, 4 payoffs (all
  // members themselves). Drop-in over the shared factory; Angela - Night Warrior's "lose
  // Stone by Day" is caught by the team-buff "lose" verb.
  gargoyle: {playstyleId: 'gargoyle', memberClasses: ['Gargoyle'], refWords: ['Gargoyle']},
  // Madrigals — the Encanto family (mostly Set 12). 26 members, 3 payoffs, all "if you have
  // another Madrigal in play" checks the in-play-check role already catches. Drop-in, no new
  // patterns. The Madrigal Family's "Madrigal Shift" stays with Shift Targets.
  madrigal: {playstyleId: 'madrigal', memberClasses: ['Madrigal'], refWords: ['Madrigal']},
  // Villains — the widest tribe after Heroes (124 members, every ink, every Core set) but
  // only 2 payoffs, both caught by the shared patterns. The other cards
  // that name Villains are Hero-side hate ("deal 2 damage to chosen Villain character") and
  // stay out of the tribe.
  villain: {playstyleId: 'villain', memberClasses: ['Villain'], refWords: ['Villain']},
} as const satisfies Record<string, TribalSpec>;

const tribalPatternCache = new Map<string, {buff: RegExp; trigger: RegExp; search: RegExp; check: RegExp}>();

/** Build (once per spec, then cached) the four payoff-role regexes from the spec's ref words. */
function tribalPatterns(spec: TribalSpec) {
  const cached = tribalPatternCache.get(spec.playstyleId);
  if (cached) return cached;
  const w = spec.refWords.join('|');
  const T = `(?:${w})`;
  const p = {
    // Benefit the tribe: team buff, single-target buff, or tribal ready (all strengthen/free your bodies).
    // The `\b` after the team buff's tribe word keeps "Your Princess characters" from reading as Prince.
    buff: new RegExp(
      `your (?:other )?${T}\\b[^.]{0,18}characters? (?:get|gain|can|lose)` + // team: "your [other] X characters get/gain/can't-be..." or shed a drawback ("lose the Stone by Day ability", Angela - Night Warrior)
        `|chosen ${T} character[^.]{0,12}(?:gets|gains|can|\\+\\d)` + // single-target: "chosen X character gains ..." or a give-form "+N" stat buff (Flash - Records Specialist)
        `|ready (?:your|chosen)[^.]{0,30}${T} characters?`, // tribal ready: "ready your other exerted X characters"
      'i',
    ),
    // Repeating trigger tied to the tribe: on play, quest, or challenge.
    trigger: new RegExp(
      `whenever you play (?:a|an|another|this or another) ${T}\\b` + // "whenever you play another X"
        `|whenever[^.]{0,40}your (?:other )?${T} characters?[^.]{0,20}(?:quest|challenge)`, // "whenever one of your X characters challenges"
      'i',
    ),
    // Deck dig for a tribe member.
    search: new RegExp(`(?:search your deck for|reveal) (?:a|an) ${T} character`, 'i'),
    // Conditional gated on tribe presence or a tribe event this turn.
    check: new RegExp(
      `(?:while|if) you have (?:a|an|another|\\d+ or more)[^.]{0,30}(?<!named (?:[\\w'-]+ ){0,2})${T}\\b` + // "while you have a [Dwarfs or a] X character in play", never a name ("an item named X", "a character named Mirabel X")
        `|if (?:a|an) (?:\\w+ or (?:a )?)?${T}(?: or \\w+)? character (?:is|card)` + // "if a [Y or] X [or Y] character is in play/chosen"
        `|if you (?:played|returned)[^.]{0,20}${T} character` + // "if you played a X character this turn"
        `|if (?:that card|the \\w+) is (?:a|an) ${T} character card`, // "if that card is a X character card"
      'i',
    ),
  };
  tribalPatternCache.set(spec.playstyleId, p);
  return p;
}

/** Determine a card's roles for one tribal spec. Multi-role allowed; payoffs never require membership. */
export function getTribalRoles(card: LorcanaCard, spec: TribalSpec): TribalRole[] {
  const roles: TribalRole[] = [];
  if (card.type === 'Character' && spec.memberClasses.some((c) => hasClassification(card, c))) roles.push('member');

  if (card.text != null) {
    const text = normalizeCardText(card);
    const p = tribalPatterns(spec);
    if (p.buff.test(text)) roles.push('buff');
    if (p.trigger.test(text)) roles.push('trigger');
    if (p.search.test(text)) roles.push('search');
    if (p.check.test(text)) roles.push('in-play-check');
  }
  return roles;
}

export const isTribalCard = (card: LorcanaCard, spec: TribalSpec): boolean =>
  getTribalRoles(card, spec).length > 0;

const CAPITALIZED_WORD = /\b[A-Z][a-z]+\b/g;

/**
 * The classifications a tribe payoff's clauses name, read as the capitalized words of every
 * clause a payoff role matched: Agnarr - King of Arendelle's "While you have a Queen" names Queen,
 * and Hans - Noble Scoundrel's "if a Princess or Queen character is" names Princess and Queen.
 * The clause's other capitalized words ("While", "Your") are no classification any card holds.
 */
export function tribalPayoffClasses(card: LorcanaCard, spec: TribalSpec): string[] {
  const text = normalizeCardText(card);
  const clauses = Object.values(tribalPatterns(spec)).flatMap(
    (pattern) => text.match(new RegExp(pattern.source, 'gi')) ?? [],
  );
  return clauses.flatMap((clause) => clause.match(CAPITALIZED_WORD) ?? []);
}
