import type {Ink, CardType, LorcanaJSONCard} from 'inkweave-synergy-engine';
import {REVEAL_SET_CODE, REVEAL_ID_BASE} from './constants';

export interface RevealCardForm {
  collectorNumber: string;
  name: string;
  version: string;
  rarity: string;
  franchise: string;
  cost: string;
  ink: Ink;
  ink2: '' | Ink;
  inkwell: boolean;
  type: CardType;
  strength: string;
  willpower: string;
  lore: string;
  moveCost: string;
  subtypes: string; // comma / newline separated
  keywords: string; // comma / newline separated, each like "Singer 5"
  fullText: string;
}

function parseIntOrUndef(v: string): number | undefined {
  const t = v.trim();
  if (t === '') return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isNaN(n) ? undefined : n;
}

function splitList(v: string): string[] {
  return v
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** "Sing Together 7" -> {keyword:"Sing Together", keywordValue:"7"}; "Evasive" -> {keyword:"Evasive"}. */
export function parseKeyword(raw: string): {keyword: string; keywordValue?: string} {
  const m = raw.trim().match(/^(.*?)\s+([+-]?\d+)$/);
  if (m) return {keyword: m[1], keywordValue: m[2]};
  return {keyword: raw.trim()};
}

export function buildPreviewCard(formInput: RevealCardForm): LorcanaJSONCard {
  const collector = Number.parseInt(formInput.collectorNumber.trim(), 10);
  const name = formInput.name.trim();
  const version = formInput.version.trim();
  const color = formInput.ink2 ? `${formInput.ink}-${formInput.ink2}` : formInput.ink;
  const subtypes = splitList(formInput.subtypes);
  const fullText = formInput.fullText.replace(/\r\n/g, '\n').trim();
  const sections = fullText
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s !== '');

  const abilities = splitList(formInput.keywords).map((k) => {
    const {keyword, keywordValue} = parseKeyword(k);
    return keywordValue
      ? {type: 'keyword', keyword, keywordValue, fullText: `${keyword} ${keywordValue}`}
      : {type: 'keyword', keyword, fullText: keyword};
  });

  const card: LorcanaJSONCard = {
    id: REVEAL_ID_BASE + collector,
    name,
    fullName: version ? `${name} - ${version}` : name,
    cost: parseIntOrUndef(formInput.cost) ?? 0,
    color,
    inkwell: formInput.inkwell,
    type: formInput.type,
    setCode: REVEAL_SET_CODE,
    number: collector,
  };

  if (version) card.version = version;
  if (formInput.rarity) card.rarity = formInput.rarity;
  if (formInput.franchise.trim()) card.franchise = formInput.franchise.trim();
  if (subtypes.length) card.subtypes = subtypes;
  if (abilities.length) card.abilities = abilities;
  if (fullText) {
    card.fullText = fullText;
    card.fullTextSections = sections;
  }

  const strength = parseIntOrUndef(formInput.strength);
  const willpower = parseIntOrUndef(formInput.willpower);
  const lore = parseIntOrUndef(formInput.lore);
  const moveCost = parseIntOrUndef(formInput.moveCost);
  if (strength !== undefined) card.strength = strength;
  if (willpower !== undefined) card.willpower = willpower;
  if (lore !== undefined) card.lore = lore;
  if (moveCost !== undefined) card.moveCost = moveCost;

  return card;
}
