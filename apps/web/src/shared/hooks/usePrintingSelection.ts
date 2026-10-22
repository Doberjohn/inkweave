import {useState} from 'react';
import type {CardPrinting, LorcanaCard} from 'inkweave-synergy-engine';
import {PROMO_RARITY, isChaseRarity} from '../../features/cards/loader';
import {SET_PRINTED_SIZES} from '../constants';
import {trackEvent} from '../lib/analytics';

/** One printing of a card: its Standard art, or one of its alternate printings (#625). */
export interface Printing {
  /** 'standard', or the variant's id. */
  key: string;
  /** What the printing switcher shows: "Standard", or the variant's `printingName`. */
  label: string;
  /** The variant's printed rarity; absent for the Standard printing. */
  rarity?: string;
  /** The variant's collector number; absent for the Standard printing. */
  number?: number;
  /** A promo's set as printed on the card ("P1" in 25/P1); absent on every other printing. */
  promoGrouping?: string;
  /**
   * Only where a promo's finish tells it from a sibling printing under its code; none does
   * today. A promo printed in both finishes is one printing, counted in both like any card
   * (owner, 2026-10-18).
   */
  finish?: 'foil' | 'normal';
  /** "A" in Dreamborn's 24A/P2: a promo printed in two arts under one number (#805, #891). */
  artVariant?: string;
  /**
   * The name printed on a promo where it is not its card's: "Vaiana" on 26/P2's European
   * printing (owner, 2026-10-18; #891).
   */
  printedName?: string;
  imageUrl?: string;
  /** Language code ("it") of this printing's scan if not English; absent means English. */
  scanLanguage?: string;
}

/** What a printing is, which decides how the printing switcher names it (#802). */
export type PrintingKind = 'standard' | 'chase' | 'altFoil' | 'promo';

/**
 * A printing's kind, from its printed rarity: none for the Standard art, a chase rarity (Epic,
 * Enchanted, Iconic) with a symbol of its own, Special for a promo, and anything else for a
 * printing that keeps its base card's rarity (Violet Parr's Super Rare #247), an alt foil.
 */
export function printingKind(rarity: string | undefined): PrintingKind {
  if (rarity === undefined) return 'standard';
  if (isChaseRarity(rarity)) return 'chase';
  return rarity === PROMO_RARITY ? 'promo' : 'altFoil';
}

/** What a promo twin's finish adds to its name: the collection parser's "normal" reads "non-foil". */
export const FINISH_WORD = {foil: 'foil', normal: 'non-foil'} as const;

/** What names a printing. */
type PrintingFacts = Pick<
  Printing,
  'number' | 'promoGrouping' | 'finish' | 'artVariant' | 'printedName'
>;

/**
 * A promo's code as printed on the card ("25/P1"), or what is known of it: its set alone while its
 * number is unknown, and its number alone ("#1", as before #802) without a set, which every promo
 * now carries.
 */
export function promoCode({number, promoGrouping, artVariant = ''}: PrintingFacts): string {
  if (promoGrouping === undefined) return number === undefined ? 'Promo' : `#${number}`;
  return number === undefined ? promoGrouping : `${number}${artVariant}/${promoGrouping}`;
}

/** A number out of the card's set's printed size, "52/204"; none when either is unknown. */
function numberOutOfSet(card: LorcanaCard, number: number | undefined): string | undefined {
  const size = SET_PRINTED_SIZES[card.setCode ?? ''];
  return number === undefined || size === undefined ? undefined : `${number}/${size}`;
}

/**
 * The number printed on a card's printing (owner, 2026-10-20: the card window's header shows
 * it): the Standard printing's collector number out of its set's size, "52/204", a chase or
 * alt foil printing's own number, "223/204", and a promo's code, "25/P1", as is a promo card's
 * own (#805). None when it is not known.
 */
export function printedCardNumber(card: LorcanaCard, printing?: Printing): string | undefined {
  if (printing?.rarity === undefined) {
    if (card.rarity !== PROMO_RARITY) return numberOutOfSet(card, card.setNumber);
    return promoCode({number: card.setNumber, promoGrouping: card.setCode});
  }
  return printing.promoGrouping === undefined ? numberOutOfSet(card, printing.number) : promoCode(printing);
}

/**
 * The name printed on a card's printing: its card's own, or the name a promo was printed under
 * with its card's version, as 26/P2's European printing reads "Vaiana - Adventurer of Land and
 * Sea" (owner, 2026-10-18). The card window's title, its copies stripe and a printing's art
 * name it so (#891), as collection mode's promo pocket does.
 */
export function printedFullName(
  card: Pick<LorcanaCard, 'fullName' | 'version'>,
  printedName?: string,
): string {
  if (printedName === undefined) return card.fullName;
  return card.version ? `${printedName} - ${card.version}` : printedName;
}

/**
 * What the printing switcher calls an alternate printing (#802): a chase rarity by its name, a
 * promo by the code printed on it plus the name it was printed under where that isn't its card's
 * (Moana's European 26/P2 Vaiana, #891) and the finish that only twins carry, and a printing that
 * keeps its base card's rarity "Alt foil" (its number alone told nothing, #796).
 */
export function printingName(printing: PrintingFacts & {rarity: string}): string {
  const kind = printingKind(printing.rarity);
  if (kind === 'chase') return printing.rarity;
  if (kind === 'altFoil') return 'Alt foil';
  const code = promoCode(printing);
  const named = printing.printedName ? `${code} ${printing.printedName}` : code;
  return printing.finish ? `${named} ${FINISH_WORD[printing.finish]}` : named;
}

/**
 * What assistive tech hears for a printing (#802): its label, with an alt foil's collector
 * number added (a card could hold two) and a promo called one (its code alone means little
 * read aloud).
 */
export function printingSpokenName(printing: PrintingFacts & Pick<Printing, 'label' | 'rarity'>): string {
  const kind = printingKind(printing.rarity);
  if (kind === 'altFoil') return `Alt foil, #${printing.number}`;
  if (kind !== 'promo') return printing.label;
  const name = printing.printedName ? `, ${printing.printedName}` : '';
  const finish = printing.finish ? `, ${FINISH_WORD[printing.finish]}` : '';
  return `Promo ${promoCode(printing)}${name}${finish}`;
}

/**
 * Accessible name for a printing's image: the name printed on it (`printedFullName`), plus the
 * printing's name for a variant.
 */
export function printingAlt(card: LorcanaCard, printing: PrintingFacts & {rarity?: string}): string {
  const {rarity, printedName} = printing;
  const name = printedFullName(card, printedName);
  if (!rarity) return name;
  // The name already says what is printed on the card, so the printing goes by its code alone.
  return `${name}, ${printingName({...printing, rarity, printedName: undefined})} printing`;
}

/** Where a promo whose number is unknown sorts by number: after every numbered one. */
const UNNUMBERED = Number.MAX_SAFE_INTEGER;

/**
 * The switcher's order (#802): the chase and alt foil printings by collector number, then the
 * promos by set and number. Promo numbers restart in every set, so they sort apart, and a promo
 * whose number is unknown comes last in its set (#805).
 */
export function byDisplayOrder(a: CardPrinting, b: CardPrinting): number {
  const promosLast = Number(a.rarity === PROMO_RARITY) - Number(b.rarity === PROMO_RARITY);
  const bySet = (a.promoGrouping ?? '').localeCompare(b.promoGrouping ?? '', undefined, {numeric: true});
  return promosLast || bySet || (a.number ?? UNNUMBERED) - (b.number ?? UNNUMBERED);
}

/** Records a view of a variant printing; the Standard printing is the card itself, not a view. */
function recordView(card: LorcanaCard, printing: Printing, surface: 'card_page' | 'modal') {
  if (printing.rarity) {
    trackEvent('card_printing_view', {
      cardId: card.id,
      printingId: printing.key,
      rarity: printing.rarity,
      surface,
    });
  }
}

/**
 * A card's printings: its Standard art first, then each alternate printing in display order
 * (`byDisplayOrder`). Each carries its own scan's language, since a variant can be revealed
 * abroad first (#681).
 */
export function printingsOf(card: LorcanaCard): Printing[] {
  const standard: Printing = {
    key: 'standard',
    label: 'Standard',
    imageUrl: card.imageUrl,
    scanLanguage: card.scanLanguage,
  };
  // Sorted on a copy: the card's own variants are shared card data.
  const variants = [...(card.variants ?? [])].sort(byDisplayOrder).map((v): Printing => ({
    key: v.id,
    label: printingName(v),
    rarity: v.rarity,
    number: v.number,
    promoGrouping: v.promoGrouping,
    finish: v.finish,
    artVariant: v.artVariant,
    printedName: v.printedName,
    imageUrl: v.imageUrl,
    scanLanguage: v.scanLanguage,
  }));
  return [standard, ...variants];
}

/**
 * True when any printing of the card is a non-English scan (#681): the card modal then offers
 * "See translation", and its loading shell holds the toggle's place.
 */
export function hasForeignScan(card: LorcanaCard): boolean {
  return printingsOf(card).some((p) => p.scanLanguage);
}

/**
 * The printing index shown for `cardId`. Each card starts on `initialIndex` as it arrives,
 * opened or paged to: the printing the open names for it, else its Standard printing (0).
 * The same card arrives again when it is reached with another printing to start on: a
 * binder holds a card and its printings as pockets side by side under Name A-Z, and paging
 * between them keeps the id. `resetWhen` (the modal closing, or entering a comparison,
 * which always shows base art) puts the card back on Standard for good: its start applies
 * again only once another card has arrived. The render-time updates are the same pattern
 * as the modal's `useCardTranslation`.
 */
function useCardSelection(cardId: string, resetWhen: boolean, initialIndex: number) {
  const start = resetWhen ? 0 : Math.max(initialIndex, 0);
  const [selected, setSelected] = useState({cardId, initialIndex, index: start});
  const arrived = selected.cardId !== cardId || selected.initialIndex !== initialIndex;
  if (arrived) setSelected({cardId, initialIndex, index: start});
  else if (resetWhen && selected.index !== 0) setSelected({cardId, initialIndex, index: 0});
  const select = (next: number) => setSelected({cardId, initialIndex, index: next});
  return {selectedIndex: arrived || resetWhen ? start : selected.index, select};
}

/**
 * Which printing of `card` is shown (see useCardSelection for when it resets to Standard),
 * and the `card_printing_view` it records, once per variant a visitor settles on: `pick` (a
 * pill, already settled) records, and so does `settle` (the strip at rest after a swipe, from
 * PrintingCarousel's `onSettle`). `select` only follows the strip's live index as a swipe
 * crosses printings, so it records nothing. `initialKey` (a variant's id) starts the card on
 * that printing instead of Standard: the reveals board opens its special slots that way, and
 * Browse names one for each card the modal's arrows reach (CardModalContext's `printingFor`).
 */
export function usePrintingSelection(
  card: LorcanaCard,
  {
    resetWhen = false,
    surface,
    initialKey = null,
  }: {resetWhen?: boolean; surface: 'card_page' | 'modal'; initialKey?: string | null},
) {
  const printings = printingsOf(card);
  const initialIndex = printings.findIndex((printing) => printing.key === initialKey);
  const {selectedIndex, select} = useCardSelection(card.id, resetWhen, initialIndex);
  // A selection past this card's printings falls back to Standard.
  const index = selectedIndex < printings.length ? selectedIndex : 0;
  const settle = (at: number) => recordView(card, printings[at], surface);
  const pick = (next: number) => {
    if (next === index) return;
    select(next);
    settle(next);
  };
  return {printings, index, select, pick, settle, current: printings[index]};
}
