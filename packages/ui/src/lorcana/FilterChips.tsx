import {Fragment, type CSSProperties, type ReactNode} from 'react';
import {picksExactly, type ArtPreset, type FilterPicks} from '../lib/filterModel';
import {FONT_SIZES, SPACING} from '../tokens/theme';
import {Chip} from '../components/Chip';

/**
 * The filters' chip rows, shared by FilterContent's sections and the app's binder rule lines, so a
 * pick reads and acts the same wherever it is made.
 */

/**
 * A wrapping row of toggle chips, the kit's selection recipe (owner, 2026-10-08: chips replace the
 * Type buttons and the Keyword and Classification dropdowns, so several can be picked). What several
 * picks MEAN is the filter's business: any of the types, but every keyword and every classification.
 * With an `ariaLabel` the row is a group of its own; without one, the caller's group names it.
 */
export function ChipToggleGroup<T extends string>({
  values,
  selected,
  onToggle,
  ariaLabel,
  isMobile,
  iconFor,
  labelFor,
  groupOf,
  justifyContent,
}: {
  values: readonly T[];
  selected: readonly T[];
  onToggle: (value: T) => void;
  ariaLabel?: string;
  isMobile: boolean;
  /** A glyph shown instead of a chip's name, e.g. the rarity symbol; a value without one shows its name. */
  iconFor?: (value: T) => ReactNode;
  /** A chip's name where it isn't the value itself: Special reads "Promo" (#805). */
  labelFor?: (value: T) => string;
  /** Each value's group; a value starting another group starts a new line. */
  groupOf?: (value: T) => string;
  /** How each line spreads its chips; packed from the start unless set. */
  justifyContent?: CSSProperties['justifyContent'];
}) {
  return (
    // The toolbar's active-chip row should match this gap, so both chip rows read alike (it's
    // still 6 until deck-builder's spacing lands, #548).
    <div role={ariaLabel ? 'group' : undefined} aria-label={ariaLabel} style={{...CHIP_ROW, justifyContent}}>
      {values.map((value, i) => (
        <Fragment key={value}>
          {startsGroup(values, i, groupOf) && <span aria-hidden style={LINE_BREAK} />}
          <Chip
            label={labelFor?.(value) ?? value}
            icon={iconFor?.(value)}
            active={selected.includes(value)}
            onClick={() => onToggle(value)}
            isMobile={isMobile}
          />
        </Fragment>
      ))}
    </div>
  );
}

const CHIP_ROW: CSSProperties = {display: 'flex', flexWrap: 'wrap', gap: SPACING.sm};

/** A zero-height flex item a full line wide: whatever follows it starts a new line. */
const LINE_BREAK: CSSProperties = {flexBasis: '100%', height: 0};

/** Whether `values[i]` starts a group other than the value before it. */
function startsGroup<T>(values: readonly T[], i: number, groupOf?: (value: T) => string): boolean {
  return i > 0 && groupOf !== undefined && groupOf(values[i]) !== groupOf(values[i - 1]);
}

/**
 * The small chips under a section's options (the art presets, Dual-ink cards): compact beside
 * full-size options on a wide screen, the kit's touch size on a phone, where they would otherwise
 * be about 20px tall.
 */
const compactChip = (isMobile: boolean): CSSProperties | undefined =>
  isMobile ? undefined : {padding: `${SPACING.xxs}px ${SPACING.md}px`, fontSize: `${FONT_SIZES.sm}px`};

/**
 * STANDARD CARDS / ALT ART CARDS (owner, 2026-10-15): shortcuts that pick one kind's rarities, as
 * picking them one by one would, replacing whatever else was picked. A preset lights up while the
 * picks are exactly its kind's, so picking or unpicking any rarity besides puts it out; picked again
 * while lit, it clears them. Under the rarity symbols, as Dual-ink cards sits under the inks.
 * `style` places the row: centred under a section's symbols, or a line of its own.
 */
export function ArtPresets({presets, picked, onPick, isMobile, style}: {
  presets: readonly ArtPreset[];
  picked: readonly string[];
  onPick: (next: string[]) => void;
  isMobile: boolean;
  style?: CSSProperties;
}) {
  return (
    // The same gap as between the rarity chips above.
    <div role="group" aria-label="Card art" style={{...PRESET_ROW, ...style}}>
      {presets.map(({value, label, title, rarities}) => {
        const lit = picksExactly(picked, rarities);
        return (
          <Chip
            key={value}
            label={label}
            active={lit}
            title={title}
            onClick={() => onPick(lit ? [] : [...rarities])}
            isMobile={isMobile}
            style={compactChip(isMobile)}
          />
        );
      })}
    </div>
  );
}

const PRESET_ROW: CSSProperties = {display: 'flex', gap: SPACING.sm};

/**
 * DUAL-INK CARDS (owner, 2026-10-08): narrows the ink result to its dual-ink cards, one ink's
 * (Amber: every Amber dual) or one pair's (Amber + Steel: Amber-Steel). See `FilterPicks.inkMatch`
 * and the vocabulary's `offersDualInk`, which says where to show it. One toggle chip: off is the
 * default, and the kit's chip already has the selected-state recipe.
 */
export function DualInkToggle({filters, onFiltersChange, isMobile}: {
  filters: FilterPicks;
  onFiltersChange: (filters: FilterPicks) => void;
  isMobile: boolean;
}) {
  const on = filters.inkMatch === 'dual';
  return (
    <Chip
      label="Dual-ink cards"
      active={on}
      title="Only the dual-ink cards of the selected inks"
      onClick={() => onFiltersChange({...filters, inkMatch: on ? undefined : 'dual'})}
      isMobile={isMobile}
      style={compactChip(isMobile)}
    />
  );
}
