import {useRef, type CSSProperties, type KeyboardEvent, type Ref} from 'react';
import type {VariantRarity} from 'inkweave-synergy-engine';
import {useHover} from '../hooks';
import {
  COLORS,
  EASING,
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

interface PrintingPillsProps {
  /** The card's printings in display order: Standard first, then its variants. */
  printings: ReadonlyArray<{key: string; label: string; rarity?: VariantRarity}>;
  /** The printing shown now. */
  index: number;
  onSelect: (index: number) => void;
  /** Larger tap targets on touch layouts. */
  isMobile?: boolean;
  style?: CSSProperties;
}

/**
 * Each alternate printing's official rarity symbol, as printed on the card. `?no-inline` keeps
 * them separate content-hashed files instead of base64 in the JS, so the art loads only when a
 * switcher shows it (the three are ~2 kB each, under Vite's inline limit).
 */
const RARITY_SYMBOLS: Record<VariantRarity, string> = {
  Enchanted: enchantedSymbol,
  Epic: epicSymbol,
  Iconic: iconicSymbol,
};

const NEXT_KEYS: Record<string, 1 | -1> = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};

interface SegmentSize {
  padding: string;
  fontSize: number;
}

/**
 * Pill size by layout. Three or more printings tighten the padding and text, and show each
 * variant by its symbol alone (see PillContent), so that four pills still fit a 360px phone
 * (~296px of content) and the desktop card column (298px): no card has ever had more than
 * one alternate printing, but a row this wide must not widen the page if one does.
 */
function segmentSize(isMobile: boolean, compact: boolean): SegmentSize {
  if (compact) return {padding: isMobile ? '6px 10px' : '4px 9px', fontSize: FONT_SIZES.md};
  return {padding: isMobile ? '7px 16px' : '5px 14px', fontSize: FONT_SIZES.base};
}

function segmentStyle(checked: boolean, hovered: boolean, size: SegmentSize): CSSProperties {
  return {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: SPACING.xs,
    border: `1px solid ${checked ? GOLD_GLOW.activeBorder : 'transparent'}`,
    borderRadius: RADIUS.pill,
    background: checked ? GOLD_GLOW.activeBg : hovered ? GOLD_GLOW.hoverBg : 'transparent',
    boxShadow: checked ? GOLD_GLOW.shadow : 'none',
    color: checked || hovered ? COLORS.primary : COLORS.textMuted,
    fontFamily: FONTS.body,
    fontSize: `${size.fontSize}px`,
    fontWeight: checked ? 600 : 500,
    padding: size.padding,
    cursor: 'pointer',
    transition: `background 0.25s ${EASING.snappy}, color 0.25s ${EASING.snappy}, box-shadow 0.25s ${EASING.snappy}`,
  };
}

/** A variant's rarity symbol (decorative: the pill's name says it) and, unless compact, its name. */
function PillContent({
  label,
  rarity,
  symbolOnly,
}: {
  label: string;
  rarity?: VariantRarity;
  symbolOnly: boolean;
}) {
  return (
    <>
      {rarity && (
        <img
          src={RARITY_SYMBOLS[rarity]}
          alt=""
          width={ICON_SIZE.sm}
          height={ICON_SIZE.sm}
          style={{display: 'block', flexShrink: 0}}
        />
      )}
      {!symbolOnly && label}
    </>
  );
}

/**
 * The printing switcher (#625): a segmented "Standard | ◈ Enchanted" control for a card with
 * an alternate printing, each variant marked with its rarity symbol. A radio group (ARIA radio
 * pattern): one tab stop, arrow keys move the selection AND focus, wrapping at the ends.
 * Renders nothing for a single printing.
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
  const compact = printings.length > 2;
  const size = segmentSize(isMobile, compact);

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
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.pill,
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
          // Compact rows name a variant by its symbol alone; the name stays for assistive
          // tech and as a hover tooltip.
          symbolOnly={compact && !!printing.rarity}
          size={size}
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
  symbolOnly,
  size,
  onSelect,
  onKeyDown,
}: {
  ref: Ref<HTMLButtonElement>;
  printing: {label: string; rarity?: VariantRarity};
  checked: boolean;
  symbolOnly: boolean;
  size: SegmentSize;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  const {hovered, hoverProps} = useHover();
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={symbolOnly ? printing.label : undefined}
      title={symbolOnly ? printing.label : undefined}
      tabIndex={checked ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      {...hoverProps}
      style={segmentStyle(checked, hovered, size)}>
      <PillContent label={printing.label} rarity={printing.rarity} symbolOnly={symbolOnly} />
    </button>
  );
}
