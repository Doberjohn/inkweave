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

/** One keyword ability per chip; the engine reads only these from `abilities`. */
function buildAbilities(keywords: string): NonNullable<LorcanaJSONCard['abilities']> {
  return splitList(keywords).map((k) => {
    const {keyword, keywordValue} = parseKeyword(k);
    return keywordValue
      ? {type: 'keyword', keyword, keywordValue, fullText: `${keyword} ${keywordValue}`}
      : {type: 'keyword', keyword, fullText: keyword};
  });
}

/** Text + taxonomy fields, each omitted when empty. */
function describe(form: RevealCardForm, version: string): Partial<LorcanaJSONCard> {
  const out: Partial<LorcanaJSONCard> = {};
  if (version) out.version = version;
  if (form.rarity) out.rarity = form.rarity;
  if (form.franchise.trim()) out.franchise = form.franchise.trim();

  const subtypes = splitList(form.subtypes);
  if (subtypes.length) out.subtypes = subtypes;

  const abilities = buildAbilities(form.keywords);
  if (abilities.length) out.abilities = abilities;

  const fullText = form.fullText.replace(/\r\n/g, '\n').trim();
  if (fullText) {
    out.fullText = fullText;
    out.fullTextSections = fullText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s !== '');
  }
  return out;
}

/** Numeric stat fields, each omitted when blank. */
function stats(form: RevealCardForm): Partial<LorcanaJSONCard> {
  const out: Partial<LorcanaJSONCard> = {};
  const strength = parseIntOrUndef(form.strength);
  const willpower = parseIntOrUndef(form.willpower);
  const lore = parseIntOrUndef(form.lore);
  const moveCost = parseIntOrUndef(form.moveCost);
  if (strength !== undefined) out.strength = strength;
  if (willpower !== undefined) out.willpower = willpower;
  if (lore !== undefined) out.lore = lore;
  if (moveCost !== undefined) out.moveCost = moveCost;
  return out;
}

export function buildPreviewCard(formInput: RevealCardForm): LorcanaJSONCard {
  const collector = Number.parseInt(formInput.collectorNumber.trim(), 10);
  const name = formInput.name.trim();
  const version = formInput.version.trim();

  const card: LorcanaJSONCard = {
    id: REVEAL_ID_BASE + collector,
    name,
    fullName: version ? `${name} - ${version}` : name,
    cost: parseIntOrUndef(formInput.cost) ?? 0,
    color: formInput.ink2 ? `${formInput.ink}-${formInput.ink2}` : formInput.ink,
    inkwell: formInput.inkwell,
    type: formInput.type,
    setCode: REVEAL_SET_CODE,
    number: collector,
  };

  return Object.assign(card, describe(formInput, version), stats(formInput));
}
