import {useRef, type CSSProperties, type KeyboardEvent, type Ref} from 'react';
import {useHover} from '../hooks';
import {
  FINISH_WORD,
  printingKind,
  printingSpokenName,
  promoCode,
  type Printing,
} from '../hooks/usePrintingSelection';
import {
  COLORS,
  EASING,
  FOIL_SHEEN,
  FONTS,
  FONT_SIZES,
  GOLD_GLOW,
  ICON_SIZE,
  RADIUS,
  SPACING,
} from '../constants';
import enchantedSymbol from '../../assets/enchanted.webp?no-inline';
import epicSymbol from '../../assets/epic.webp?no-inline';
import iconicSymbol from '../../assets/iconic.webp?no-inline';
import promoSymbol from '../../assets/promo.webp?no-inline';

/** What a chip reads from usePrintingSelection's Printing. */
type PrintingChip = Pick<
  Printing,
  'key' | 'label' | 'rarity' | 'number' | 'promoGrouping' | 'finish'
>;

interface PrintingPillsProps {
  /** The card's printings in display order: Standard first, then its variants. */
  printings: ReadonlyArray<PrintingChip>;
  /** The printing shown now. */
  index: number;
  onSelect: (index: number) => void;
  /** Larger tap targets on touch layouts. */
  isMobile?: boolean;
  style?: CSSProperties;
}

/**
 * The official symbol printed on the card for each rarity that has one: the three chase rarities
 * and promos (Special, #802). `?no-inline` keeps them separate content-hashed files instead of
 * base64 in the JS, so the art loads only when a switcher shows it (the four are ~1.5-2.5 kB each,
 * under Vite's inline limit).
 */
const RARITY_SYMBOLS: Partial<Record<string, string>> = {
  Enchanted: enchantedSymbol,
  Epic: epicSymbol,
  Iconic: iconicSymbol,
  Special: promoSymbol,
};

const NEXT_KEYS: Record<string, 1 | -1> = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};

/** The gap between chips. */
const CHIP_GAP = SPACING.xs + SPACING.xxs;

/**
 * Chip padding by layout. Ten pixels a side on desktop, with SPACING.xs between a symbol and its
 * name, lets Mr. Incredible - Super Strong's three chips (Standard, Enchanted, Alt foil: about
 * 278px) share one line of the desktop card column, 289px at 1920 wide; twelve and six needed
 * 294px. Touch layouts keep larger tap targets and wrap sooner.
 */
const PADDING = {desktop: '5px 10px', touch: '7px 16px'} as const;

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
 * A promo twin's finish, set lighter after its code. 0.85 keeps the muted text at about 5:1 on
 * COLORS.surface, above WCAG AA's 4.5:1 for 13px text; the mockup's 0.75 fell to about 4.2:1.
 */
const FINISH_STYLE: CSSProperties = {fontWeight: 500, opacity: 0.85};

function chipStyle(checked: boolean, hovered: boolean, isMobile: boolean): CSSProperties {
  return {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: SPACING.xs,
    border: `1px solid ${checked ? GOLD_GLOW.activeBorder : COLORS.surfaceBorder}`,
    borderRadius: RADIUS.pill,
    background: checked ? GOLD_GLOW.activeBg : hovered ? GOLD_GLOW.hoverBg : 'transparent',
    boxShadow: checked ? GOLD_GLOW.shadow : 'none',
    color: checked || hovered ? COLORS.primary : COLORS.textMuted,
    fontFamily: FONTS.body,
    fontSize: `${FONT_SIZES.base}px`,
    fontWeight: checked ? 600 : 500,
    padding: isMobile ? PADDING.touch : PADDING.desktop,
    cursor: 'pointer',
    transition: `background 0.25s ${EASING.snappy}, color 0.25s ${EASING.snappy}, box-shadow 0.25s ${EASING.snappy}`,
  };
}

/**
 * A promo's name: the code printed on it, and the finish that only twins carry. The chip's gap
 * spaces the two on screen, and the space a flex item starts with renders nothing, but copying
 * or finding the text needs it ("8/C1 foil", not "8/C1foil").
 */
function PromoName({printing}: {printing: PrintingChip}) {
  return (
    <>
      {promoCode(printing)}
      {printing.finish && <span style={FINISH_STYLE}>{` ${FINISH_WORD[printing.finish]}`}</span>}
    </>
  );
}

/**
 * What a chip shows (#802): its rarity's symbol when it has one (decorative: the name says it),
 * the foil marker for an alt foil, then its name. Never a symbol alone.
 */
function ChipContent({printing}: {printing: PrintingChip}) {
  const kind = printingKind(printing.rarity);
  const symbol = printing.rarity ? RARITY_SYMBOLS[printing.rarity] : undefined;
  return (
    <>
      {symbol && (
        <img src={symbol} alt="" width={ICON_SIZE.sm} height={ICON_SIZE.sm} style={SYMBOL_STYLE} />
      )}
      {kind === 'altFoil' && <span aria-hidden="true" style={FOIL_MARKER} />}
      {kind === 'promo' ? <PromoName printing={printing} /> : printing.label}
    </>
  );
}

/**
 * The printing switcher (#625): a chip for each printing of a card, each saying what the printing
 * is and where it's from (#802). Standard, a chase rarity by its symbol and name, an alt foil (a
 * printing that keeps its base card's rarity) by the foil marker, a promo by the promo symbol and
 * the code printed on it. The chips wrap within the card column instead of shrinking, since a card
 * can have five printings. A radio group (ARIA radio pattern): one tab stop, arrow keys move the
 * selection AND focus, wrapping at the ends. Renders nothing for a single printing.
 *
 * It is an indicator over PrintingCarousel's scroll position, so a swipe moves it too.
 */
export function PrintingPills({
  printings,
  index,
  onSelect,
  isMobile = false,
  style,
}: PrintingPillsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (printings.length < 2) return null;

  function onKeyDown(e: KeyboardEvent) {
    const step = NEXT_KEYS[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (index + step + printings.length) % printings.length;
    onSelect(next);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Card printing"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: CHIP_GAP,
        maxWidth: '100%',
        ...style,
      }}>
      {printings.map((printing, i) => (
        <PrintingPill
          key={printing.key}
          ref={(el) => {
            refs.current[i] = el;
          }}
          printing={printing}
          checked={i === index}
          isMobile={isMobile}
          onSelect={() => onSelect(i)}
          onKeyDown={onKeyDown}
        />
      ))}
    </div>
  );
}

/**
 * One radio of the group. Its hover comes from useHover, whose touch guard ignores the mouse
 * events a tap emulates: a hand-rolled hover would stay lit after a swipe moved the selection
 * away, so two pills would look picked.
 */
function PrintingPill({
  ref,
  printing,
  checked,
  isMobile,
  onSelect,
  onKeyDown,
}: {
  ref: Ref<HTMLButtonElement>;
  printing: PrintingChip;
  checked: boolean;
  isMobile: boolean;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  const {hovered, hoverProps} = useHover();
  const spoken = printingSpokenName(printing);
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={checked}
      // The visible name, unless saying it aloud needs more: an alt foil's number, a promo's kind.
      aria-label={spoken === printing.label ? undefined : spoken}
      tabIndex={checked ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      {...hoverProps}
      style={chipStyle(checked, hovered, isMobile)}>
      <ChipContent printing={printing} />
    </button>
  );
}
