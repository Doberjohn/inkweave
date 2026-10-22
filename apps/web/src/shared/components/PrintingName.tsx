import type {CSSProperties} from 'react';
import {FINISH_WORD, printingKind, promoCode, type Printing} from '../hooks/usePrintingSelection';
import {COLORS, FOIL_SHEEN, GOLD_GLOW, ICON_SIZE, RADIUS} from '../constants';
import enchantedSymbol from '../../assets/enchanted.webp?no-inline';
import epicSymbol from '../../assets/epic.webp?no-inline';
import iconicSymbol from '../../assets/iconic.webp?no-inline';
import promoSymbol from '../../assets/promo.webp?no-inline';

/** What a printing's name reads from usePrintingSelection's Printing. */
export type NamedPrinting = Pick<
  Printing,
  'key' | 'label' | 'rarity' | 'number' | 'promoGrouping' | 'finish' | 'artVariant' | 'printedName'
>;

/**
 * The official symbol printed on the card for each rarity that has one: the three chase rarities
 * and promos (Special, #802). `?no-inline` keeps them separate content-hashed files instead of
 * base64 in the JS, so the art loads only when a name shows it (the four are ~1.5-2.5 kB each,
 * under Vite's inline limit).
 */
const RARITY_SYMBOLS: Partial<Record<string, string>> = {
  Enchanted: enchantedSymbol,
  Epic: epicSymbol,
  Iconic: iconicSymbol,
  Special: promoSymbol,
};

const SYMBOL_STYLE: CSSProperties = {display: 'block', flexShrink: 0};

/** The alt foil's marker is the app's FOIL marker: brushed gold, never a rainbow (FOIL_SHEEN). */
const FOIL_MARKER: CSSProperties = {
  ...FOIL_SHEEN.surface(COLORS.surface, false),
  width: 12,
  height: 12,
  flexShrink: 0,
  borderRadius: RADIUS.xs,
  boxShadow: `inset 0 0 0 1px ${GOLD_GLOW.activeBorder}`,
};

/**
 * What follows a promo's code to tell it from a sibling under that code, the name it was printed
 * under (#891) or a twin's finish, set lighter. 0.85 keeps the muted text at about 5:1 on
 * COLORS.surface, above WCAG AA's 4.5:1 for 13px text; the mockup's 0.75 fell to about 4.2:1.
 */
const QUALIFIER_STYLE: CSSProperties = {fontWeight: 500, opacity: 0.85};

/**
 * A promo's name: the code printed on it, then the name it was printed under where that isn't its
 * card's (26/P2 Vaiana, #891) and the finish that only twins carry. The flex gap of the name's
 * box spaces them on screen, and the space a flex item starts with renders nothing, but copying
 * or finding the text needs it ("8/C1 foil", not "8/C1foil").
 */
function PromoName({printing}: {printing: NamedPrinting}) {
  return (
    <>
      {promoCode(printing)}
      {printing.printedName && <span style={QUALIFIER_STYLE}>{` ${printing.printedName}`}</span>}
      {printing.finish && <span style={QUALIFIER_STYLE}>{` ${FINISH_WORD[printing.finish]}`}</span>}
    </>
  );
}

/**
 * A printing's name as the card window and the card page show it (#802): its rarity's symbol
 * when it has one (decorative: the name says it), the foil marker for an alt foil, then its name.
 * Never a symbol alone. Laid out by its box, a row with a gap: the notice after a turn names the
 * printing on show with it.
 */
export function PrintingName({printing}: {printing: NamedPrinting}) {
  const kind = printingKind(printing.rarity);
  const symbol = printing.rarity ? RARITY_SYMBOLS[printing.rarity] : undefined;
  return (
    <>
      {symbol && <img src={symbol} alt="" width={ICON_SIZE.sm} height={ICON_SIZE.sm} style={SYMBOL_STYLE} />}
      {kind === 'altFoil' && <span aria-hidden="true" style={FOIL_MARKER} />}
      {kind === 'promo' ? <PromoName printing={printing} /> : printing.label}
    </>
  );
}
