import {Fragment} from 'react';
import type {Ink, SetInfo} from '../../features/cards';
import type {CardFilterOptions} from '../../features/cards';
import {
  ART_OPTIONS,
  picksExactly,
  raritiesOfKind,
  rarityLabel,
  type FilterButtonOptions,
} from '../../features/cards/filterOptions';
import type {CardTypeFilter} from '../constants';
import type {InkwellValue} from 'inkweave-ui/lorcana/InkwellIcon';
import {CARD_TYPE_FILTERS, COST_BUTTONS, COLORS, FONT_SIZES, SET_LOGOS, SPACING} from '../constants';
import {Chip} from 'inkweave-ui/components/Chip';
import {offersDualOnly} from '../../features/cards/loader';
import {CostIcon} from 'inkweave-ui/lorcana/CostIcon';
import {FilterButton} from 'inkweave-ui/components/FilterButton';
import {FilterSection} from 'inkweave-ui/components/FilterSection';
import {InkFilterGroup} from 'inkweave-ui/lorcana/InkFilterGroup';
import {InkwellIcon} from 'inkweave-ui/lorcana/InkwellIcon';
import {RaritySymbol} from 'inkweave-ui/lorcana/RaritySymbol';
import {hasRaritySymbol, rarityConfigOf} from 'inkweave-ui/lib/rarity';

/** Shared props for FilterModal (desktop) and FilterDrawer (mobile). */
export interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (
    inks: Ink[],
    types: CardTypeFilter[],
    costs: number[],
    filters: CardFilterOptions,
  ) => void;
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  /** The pool's rarities, in rarity order (`getUniqueRarities`). */
  uniqueRarities: string[];
  sets: SetInfo[];
  /**
   * Limits the ink, cost, type and inkwell buttons to these values (a playstyle's card
   * pool). Left out, every value shows.
   */
  buttonOptions?: FilterButtonOptions;
  /** Offer the Set filter (the default); collection mode turns it off (see `FilterContentProps`). */
  showSetFilter?: boolean;
  /** Offer the art presets under the rarities; Browse does (see `FilterContentProps`). */
  showArtPresets?: boolean;
}

interface FilterContentProps {
  inkFilters: Ink[];
  typeFilters: CardTypeFilter[];
  costFilters: number[];
  filters: CardFilterOptions;
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  /** The pool's rarities, in rarity order (`getUniqueRarities`). */
  uniqueRarities: string[];
  sets: SetInfo[];
  /** Limits the button groups to these values; left out, every value shows. */
  buttonOptions?: FilterButtonOptions;
  onToggleInk: (ink: Ink) => void;
  onToggleType: (type: CardTypeFilter) => void;
  onToggleCost: (cost: number) => void;
  onFiltersChange: (filters: CardFilterOptions) => void;
  /**
   * Layout variant controls icon sizing and flex layout per section. `panel` is
   * Browse's docked side panel: the same narrow column as `mobile`, every section
   * included, because the toolbar no longer carries the ink, cost and inkwell
   * icons beside it.
   */
  variant: 'desktop' | 'mobile' | 'panel';
  /**
   * Whether the cost icons are shown inline in the toolbar. When false (narrow
   * desktop), the modal renders the Ink Cost section so cost stays reachable.
   * Ignored on mobile (cost always shows there). Defaults to true.
   */
  showInlineCost?: boolean;
  /**
   * Whether the inkwell toggles are shown inline in the toolbar, as Browse's are.
   * When false (the synergy toolbar has none), the modal renders the Inkwell
   * section, or inkwell would be unreachable on desktop. Ignored on mobile.
   * Defaults to true.
   */
  showInlineInkwell?: boolean;
  /**
   * At the far end of the Ink section's header line, the first wherever Ink shows: the
   * docked panel's "Clear all". Its own item on that line, so the toggle stops short of it.
   */
  headerAction?: React.ReactNode;
  /**
   * Offer the Set filter (the default). Collection mode turns it off (owner,
   * 2026-10-12): there the set is chosen in the collection panel, and a set filter
   * beside it could only empty the binder of every other set.
   */
  showSetFilter?: boolean;
  /**
   * Offer the art presets, Standard cards and Alt art cards, under the rarities (off by
   * default; Browse turns them on in both modes, owner 2026-10-15). They only pick
   * rarities, so they show only where the rarities include both kinds.
   */
  showArtPresets?: boolean;
}

// A filter value is "empty" (and should be deleted rather than stored) when it's
// unset, a blank string, or an empty array. Encapsulated so the branch logic in
// withOption stays a single named predicate instead of a complex conditional.
function isEmptyFilterValue(value: unknown): boolean {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

// A section the desktop toolbar may carry inline (cost, inkwell) shows here on
// mobile always, and on desktop only when the toolbar does NOT carry it. Hoisted
// out of the component to keep its CC down.
function shouldShowSection(isDesktop: boolean, shownInline: boolean): boolean {
  return !isDesktop || !shownInline;
}

// Each section below is its own module-level component so its .map()/ternary
// branches don't count toward FilterContent's cyclomatic complexity. FilterContent
// is left as a thin composition shell. Mirrors the original CostFilterSection.

/**
 * How a section folds in the docked panel (owner, 2026-10-08) and a phone's filter
 * sheet (owner, 2026-10-26): Ink, Inkwell, Ink Cost and Rarity start open, the rest
 * folded. On a phone the header takes a touch-sized tap area. Undefined in the desktop
 * dialog, where sections never fold. Spread into `FilterSection`.
 */
type Fold = {collapsible: {defaultOpen: boolean; touch?: boolean}} | undefined;

/** The fold for a section that starts open or folded, in the panel and on a phone; none elsewhere. */
function foldFor(variant: FilterContentProps['variant'], defaultOpen: boolean): Fold {
  if (variant === 'panel') return {collapsible: {defaultOpen}};
  return variant === 'mobile' ? {collapsible: {defaultOpen, touch: true}} : undefined;
}

/** "3, 5": the selected costs in order, for a folded Ink Cost header. */
function costSummary(costs: number[]): string | undefined {
  return costs.length ? [...costs].sort((a, b) => a - b).join(', ') : undefined;
}

/** "Character", or "2" for several: what a folded chip section's header shows. */
function listSummary(values: readonly string[]): string | undefined {
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : String(values.length);
}

/** The list with `value` added, or removed if it was there. */
const toggledIn = <T,>(values: readonly T[], value: T): T[] =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

/**
 * A wrapping row of toggle chips, the kit's selection recipe (owner, 2026-10-08:
 * chips replace the Type buttons and the Keyword and Classification dropdowns,
 * so several can be picked). What several picks MEAN is the filter's business:
 * any of the types, but every keyword and every classification.
 */
function ChipToggleGroup<T extends string>({
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
  ariaLabel: string;
  isMobile: boolean;
  /** A glyph shown instead of a chip's name, e.g. the rarity symbol; a value without one shows its name. */
  iconFor?: (value: T) => React.ReactNode;
  /** A chip's name where it isn't the value itself: Special reads "Promo" (#805). */
  labelFor?: (value: T) => string;
  /** Each value's group; a value starting another group starts a new line. */
  groupOf?: (value: T) => string;
  /** How each line spreads its chips; packed from the start unless set. */
  justifyContent?: React.CSSProperties['justifyContent'];
}) {
  return (
    // The toolbar's active-chip row should match this gap, so both chip rows read alike (it's
    // still 6 until deck-builder's spacing lands, #548).
    <div role="group" aria-label={ariaLabel} style={{display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, justifyContent}}>
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

/** A zero-height flex item a full line wide: whatever follows it starts a new line. */
const LINE_BREAK: React.CSSProperties = {flexBasis: '100%', height: 0};

/** Whether `values[i]` starts a group other than the value before it. */
function startsGroup<T>(values: readonly T[], i: number, groupOf?: (value: T) => string): boolean {
  return i > 0 && groupOf !== undefined && groupOf(values[i]) !== groupOf(values[i - 1]);
}

/**
 * Keyword, Classification or Rarity: chips, and a folded summary of what is picked. With
 * nothing to offer (a playstyle none of whose cards has a keyword), the section is left out.
 */
function ChipFilterSection({
  label,
  ariaLabel,
  values,
  selected,
  onChange,
  fold,
  isMobile,
  iconFor,
  labelFor,
  groupOf,
  justifyContent,
  below,
}: {
  label: string;
  ariaLabel: string;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  fold: Fold;
  isMobile: boolean;
  iconFor?: (value: string) => React.ReactNode;
  labelFor?: (value: string) => string;
  groupOf?: (value: string) => string;
  justifyContent?: React.CSSProperties['justifyContent'];
  /** Under the chips: the Rarity section's art presets. */
  below?: React.ReactNode;
}) {
  if (values.length === 0) return null;
  return (
    <FilterSection label={label} {...fold} summary={listSummary(labelFor ? selected.map(labelFor) : selected)}>
      <ChipToggleGroup
        values={values}
        selected={selected}
        onToggle={(value) => onChange(toggledIn(selected, value))}
        ariaLabel={ariaLabel}
        isMobile={isMobile}
        iconFor={iconFor}
        labelFor={labelFor}
        groupOf={groupOf}
        justifyContent={justifyContent}
      />
      {below && <div style={{marginTop: SPACING.sm}}>{below}</div>}
    </FilterSection>
  );
}

/**
 * A rarity's chip shows its symbol alone (owner, 2026-10-08: the symbols are
 * recognizable); the name stays as the chip's accessible name and tooltip, Promo
 * for Special (`rarityLabel`). A rarity without a symbol, should LorcanaJSON add
 * one, shows its name rather than an empty chip. Lowercased: RaritySymbol keys on
 * "super rare".
 */
const raritySymbol = (rarity: string) =>
  hasRaritySymbol(rarity) ? <RaritySymbol rarity={rarity.toLowerCase()} size={24} /> : undefined;

/**
 * The five card rarities on the top line, Common to Legendary, and the printings' below:
 * Epic, Enchanted, Iconic and Promo (owner, 2026-10-17). It was four to a line, Legendary
 * leading the special printings (2026-10-08), until the promo symbol made that line five.
 * A pool without printings (the card page's synergy filters) is one line either way.
 */
function rarityLines(rarities: readonly string[]): ((rarity: string) => string) | undefined {
  if (rarities.every((rarity) => rarityConfigOf(rarity))) return undefined;
  return (rarity) => (rarityConfigOf(rarity) ? 'cards' : 'printings');
}

/**
 * The small chips under a section's options (the art presets, Dual-ink cards): compact
 * beside full-size options on a wide screen, the kit's touch size in the phone drawer,
 * where they would otherwise be about 20px tall.
 */
const compactChip = (isMobile: boolean) =>
  isMobile ? undefined : {padding: `${SPACING.xxs}px ${SPACING.md}px`, fontSize: `${FONT_SIZES.sm}px`};

/**
 * STANDARD CARDS / ALT ART CARDS (owner, 2026-10-15): shortcuts that pick one kind's
 * rarities, as picking them one by one would, replacing whatever else was picked. A preset
 * lights up while the picks are exactly its kind's, so picking or unpicking any rarity
 * besides puts it out; picked again while lit, it clears them. Under the rarity symbols,
 * as Dual-ink cards sits under the inks.
 */
function ArtPresets({rarities, filters, onFiltersChange, isMobile}: {
  rarities: string[];
  filters: CardFilterOptions;
  onFiltersChange: (filters: CardFilterOptions) => void;
  isMobile: boolean;
}) {
  const picked = filters.rarities ?? [];
  return (
    // The same gap as between the rarity chips above.
    <div role="group" aria-label="Card art" style={{display: 'flex', justifyContent: 'center', gap: SPACING.sm}}>
      {ART_OPTIONS.map(({value, label, title}) => {
        const kind = raritiesOfKind(rarities, value);
        const lit = picksExactly(picked, kind);
        return (
          <Chip
            key={value}
            label={label}
            active={lit}
            title={title(kind)}
            onClick={() => onFiltersChange(withOption(filters, 'rarities', lit ? [] : kind))}
            isMobile={isMobile}
            style={compactChip(isMobile)}
          />
        );
      })}
    </div>
  );
}

/** Whether the offered rarities include both kinds, the only time the art presets mean anything. */
const offersBothKinds = (rarities: readonly string[]) =>
  ART_OPTIONS.every(({value}) => raritiesOfKind(rarities, value).length > 0);

/**
 * Rarity: any picked rarity, from the page's options (Browse's include its cards' printings:
 * getRaritiesWithPrintings). Open by default, with Ink, Inkwell and Ink Cost (owner,
 * 2026-10-08). Where offered, the art presets sit under the symbols.
 */
function RaritySection({
  rarities,
  filters,
  onFiltersChange,
  showArtPresets,
  fold,
  isMobile,
}: {
  rarities: string[];
  filters: CardFilterOptions;
  onFiltersChange: (filters: CardFilterOptions) => void;
  showArtPresets: boolean;
  fold: Fold;
  isMobile: boolean;
}) {
  const presets = showArtPresets && offersBothKinds(rarities);
  return (
    <ChipFilterSection
      label="Rarity"
      ariaLabel="Rarity filters"
      values={rarities}
      selected={filters.rarities ?? []}
      onChange={(next) => onFiltersChange(withOption(filters, 'rarities', next))}
      fold={fold}
      isMobile={isMobile}
      iconFor={raritySymbol}
      labelFor={rarityLabel}
      groupOf={rarityLines(rarities)}
      // The symbols spread across each line (owner, 2026-10-08).
      justifyContent="space-around"
      below={
        presets ? (
          <ArtPresets rarities={rarities} filters={filters} onFiltersChange={onFiltersChange} isMobile={isMobile} />
        ) : undefined
      }
    />
  );
}

/**
 * The docked panel's icon grid, shared by Ink (3x2) and Ink Cost (3x3) so both
 * sit in the same three equal columns. A centred, wrapping flex row packs its
 * buttons toward the middle instead, and the two sections stop lining up.
 */
const PANEL_GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  justifyItems: 'center',
  rowGap: SPACING.sm,
};

const COST_WRAP_STYLE: React.CSSProperties = {display: 'flex', gap: SPACING.sm, flexWrap: 'wrap', justifyContent: 'center'};

// Extracted into its own component so the cost-button .map() branch doesn't count
// toward FilterContent's (already large) cyclomatic complexity.
function CostFilterSection({
  costFilters,
  onToggleCost,
  grid,
  inkwell,
  fold,
  options,
}: {
  costFilters: number[];
  onToggleCost: (cost: number) => void;
  grid: boolean;
  /** The inkwell filter: Uninkable redraws the buttons in the uninkable cost hexagon. */
  inkwell: CardFilterOptions['inkwell'];
  fold: Fold;
  options: FilterButtonOptions | undefined;
}) {
  const costs = options?.costs ?? COST_BUTTONS;
  return (
    <FilterSection label="Ink Cost" {...fold} summary={costSummary(costFilters)}>
      <div
        role="group"
        aria-label="Ink cost filters"
        style={grid ? PANEL_GRID_STYLE : COST_WRAP_STYLE}>
        {costs.map((cost) => (
          <FilterButton
            key={cost}
            size="sm"
            active={costFilters.includes(cost)}
            onClick={() => onToggleCost(cost)}
            activeColor={COLORS.primary}
            activeBgColor={COLORS.primary200}
            inactiveColor="transparent"
            inactiveTextColor="transparent"
            aria-label={`Cost ${cost}${cost === 9 ? '+' : ''}`}>
            <CostIcon cost={cost} size={34} inkwell={inkwell === 'uninkable' ? 'uninkable' : 'inkable'} />
          </FilterButton>
        ))}
      </div>
    </FilterSection>
  );
}

// The drawer fits all six inks on one row; the docked panel's 260px column does
// not, so there they take a 3x2 grid.
const INK_ROW_STYLE: React.CSSProperties = {flexWrap: 'nowrap', justifyContent: 'space-evenly'};

/**
 * DUAL-INK CARDS (owner, 2026-10-08): narrows the ink result to its dual-ink cards,
 * one ink's (Amber: every Amber dual) or one pair's (Amber + Steel: Amber-Steel).
 * See `CardFilterOptions.inkMatch` and `offersDualOnly`. One toggle chip: off is
 * the default, and the kit's chip already has the selected-state recipe.
 */
function DualInkToggle({filters, onFiltersChange, isMobile}: {
  filters: CardFilterOptions;
  onFiltersChange: (filters: CardFilterOptions) => void;
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

// Not on desktop, which renders ink icons inline in the toolbar instead.
function InkFilterSection({
  inkFilters,
  onToggleInk,
  grid,
  fold,
  modeSwitch,
  action,
  options,
}: {
  inkFilters: Ink[];
  onToggleInk: (ink: Ink) => void;
  grid: boolean;
  fold: Fold;
  modeSwitch: React.ReactNode;
  action: React.ReactNode;
  options: FilterButtonOptions | undefined;
}) {
  return (
    <FilterSection label="Ink" {...fold} summary={inkFilters.join(', ') || undefined} action={action}>
      <InkFilterGroup
        inkFilters={inkFilters}
        onToggleInk={onToggleInk}
        inks={options?.inks}
        size="sm"
        iconSize={30}
        style={grid ? PANEL_GRID_STYLE : INK_ROW_STYLE}
      />
      {/* Only for one ink or a pair: a dual-ink card has exactly two inks, so
          beyond a pair the question has no single answer. Under the icons, not in
          the header: it changes how THEY combine, and the header's right end is
          the panel's "Clear all". */}
      {offersDualOnly(inkFilters.length) && (
        <div style={{display: 'flex', justifyContent: 'center', marginTop: SPACING.sm}}>{modeSwitch}</div>
      )}
    </FilterSection>
  );
}

// Mobile-only: desktop renders the inkable/uninkable toggles inline in the toolbar.
function InkwellFilterSection({
  filters,
  onFiltersChange,
  fold,
  options,
}: {
  filters: CardFilterOptions;
  onFiltersChange: (filters: CardFilterOptions) => void;
  fold: Fold;
  options: FilterButtonOptions | undefined;
}) {
  const values: readonly InkwellValue[] = options?.inkwell ?? ['inkable', 'uninkable'];
  return (
    <FilterSection
      label="Inkwell"
      {...fold}
      summary={filters.inkwell && (filters.inkwell === 'inkable' ? 'Inkable' : 'Uninkable')}>
      <div
        role="group"
        aria-label="Inkwell filters"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-evenly',
        }}>
        {values.map((value) => (
          <FilterButton
            key={value}
            size="md"
            active={filters.inkwell === value}
            onClick={() =>
              onFiltersChange({
                ...filters,
                inkwell: filters.inkwell === value ? undefined : value,
              })
            }
            activeColor={COLORS.primary500}
            activeBgColor={COLORS.primary200}>
            <span style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
              <InkwellIcon value={value} size={18} />
              {value === 'inkable' ? 'Inkable' : 'Uninkable'}
            </span>
          </FilterButton>
        ))}
      </div>
    </FilterSection>
  );
}

// Card Type toggles. Label and layout differ slightly between variants.
function CardTypeFilterSection({
  typeFilters,
  onToggleType,
  isDesktop,
  isMobile,
  fold,
  options,
}: {
  typeFilters: CardTypeFilter[];
  onToggleType: (type: CardTypeFilter) => void;
  isDesktop: boolean;
  isMobile: boolean;
  fold: Fold;
  options: FilterButtonOptions | undefined;
}) {
  const types = options?.types ?? CARD_TYPE_FILTERS;
  return (
    <FilterSection label={isDesktop ? 'Card Type' : 'Type'} {...fold} summary={listSummary(typeFilters)}>
      <ChipToggleGroup
        values={types}
        selected={typeFilters}
        onToggle={onToggleType}
        ariaLabel="Card type filters"
        isMobile={isMobile}
      />
    </FilterSection>
  );
}

/** A set's logo, sized for its tile; its name where a set has no logo art yet. */
function SetLogo({set}: {set: SetInfo}) {
  const logo = SET_LOGOS[set.code];
  if (!logo) return <span style={{fontSize: `${FONT_SIZES.sm}px`}}>{set.name}</span>;
  // Decorative: the tile's aria-label names the set. Lazy, so a folded section
  // (display: none) fetches nothing until it opens.
  return (
    <img
      src={logo}
      alt=""
      loading="lazy"
      decoding="async"
      style={{display: 'block', width: '100%', height: 40, objectFit: 'contain'}}
    />
  );
}

/** "Winterspell", or "2" for several: what a folded Set header shows. */
function setSummary(picked: string[], sets: SetInfo[]): string | undefined {
  return listSummary(picked.map((code) => sets.find((s) => s.code === code)?.name ?? `Set ${code}`));
}

/**
 * Set: the sets' logos, two per row, newest first (owner, 2026-10-08), replacing
 * the dropdown. Several can be picked, and a card in ANY of them shows (see
 * `matchesSet`). The tiles are the kit's FilterButton, the same selected glow as
 * the ink and cost buttons above.
 */
function SetLogoSection({sets, selected, onChange, fold}: {
  sets: SetInfo[];
  selected: string[];
  onChange: (next: string[]) => void;
  fold: Fold;
}) {
  const newestFirst = [...sets].sort((a, b) => b.number - a.number);
  return (
    <FilterSection label="Set" {...fold} summary={setSummary(selected, sets)}>
      <div
        role="group"
        aria-label="Set filters"
        style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: SPACING.sm}}>
        {newestFirst.map((set) => (
          <FilterButton
            key={set.code}
            size="sm"
            active={selected.includes(set.code)}
            onClick={() => onChange(toggledIn(selected, set.code))}
            activeColor={COLORS.primary}
            activeBgColor={COLORS.primary200}
            aria-label={set.name}>
            <SetLogo set={set} />
          </FilterButton>
        ))}
      </div>
    </FilterSection>
  );
}

/** The options with one option set, or removed when it is empty (`isEmptyFilterValue`). */
function withOption<K extends keyof CardFilterOptions>(
  filters: CardFilterOptions,
  key: K,
  value: CardFilterOptions[K],
): CardFilterOptions {
  const next = {...filters};
  if (isEmptyFilterValue(value)) delete next[key];
  else next[key] = value;
  return next;
}

/** The sections about what a card IS, all folded in the panel: type, keywords, classifications, set. */
function TraitSections({
  filters,
  onFiltersChange,
  typeFilters,
  onToggleType,
  uniqueKeywords,
  uniqueClassifications,
  sets,
  buttonOptions,
  showSetFilter,
  isDesktop,
  isMobile,
  fold,
}: Pick<
  FilterContentProps,
  | 'filters'
  | 'onFiltersChange'
  | 'typeFilters'
  | 'onToggleType'
  | 'uniqueKeywords'
  | 'uniqueClassifications'
  | 'sets'
  | 'buttonOptions'
> & {showSetFilter: boolean; isDesktop: boolean; isMobile: boolean; fold: Fold}) {
  const update = <K extends keyof CardFilterOptions>(key: K, value: CardFilterOptions[K]) =>
    onFiltersChange(withOption(filters, key, value));
  return (
    <>
      {/* Card Type Filter: any of the picked types */}
      <CardTypeFilterSection
        typeFilters={typeFilters}
        onToggleType={onToggleType}
        isDesktop={isDesktop}
        isMobile={isMobile}
        fold={fold}
        options={buttonOptions}
      />

      {/* Keywords: every picked keyword (see `matchesKeywords`) */}
      <ChipFilterSection
        label={isDesktop ? 'Keywords' : 'Keyword'}
        ariaLabel="Keyword filters"
        values={uniqueKeywords}
        selected={filters.keywords ?? []}
        onChange={(next) => update('keywords', next)}
        fold={fold}
        isMobile={isMobile}
      />

      {/* Classification: every picked classification, all of them A-Z */}
      <ChipFilterSection
        label="Classification"
        ariaLabel="Classification filters"
        values={uniqueClassifications}
        selected={filters.classifications ?? []}
        onChange={(next) => update('classifications', next)}
        fold={fold}
        isMobile={isMobile}
      />

      {/* Set: logos, any of the picked sets. Not in collection mode, whose set is chosen
          in the collection panel. */}
      {showSetFilter && (
        <SetLogoSection
          sets={sets}
          selected={filters.setCodes ?? []}
          onChange={(next) => update('setCodes', next)}
          fold={fold}
        />
      )}
    </>
  );
}

/**
 * Shared filter sections rendered identically in FilterModal (desktop) and
 * FilterDrawer (mobile). Only layout tuning differs between variants.
 */
export function FilterContent({
  inkFilters,
  typeFilters,
  costFilters,
  filters,
  uniqueKeywords,
  uniqueClassifications,
  uniqueRarities,
  sets,
  buttonOptions,
  onToggleInk,
  onToggleType,
  onToggleCost,
  onFiltersChange,
  variant,
  showInlineCost = true,
  showInlineInkwell = true,
  headerAction,
  showSetFilter = true,
  showArtPresets = false,
}: FilterContentProps) {
  const isDesktop = variant === 'desktop';
  const isPanel = variant === 'panel';
  // The phone drawer's chips take the kit's larger touch padding.
  const isMobile = variant === 'mobile';
  const showCostSection = shouldShowSection(isDesktop, showInlineCost);
  const showInkwellSection = shouldShowSection(isDesktop, showInlineInkwell);
  const open = foldFor(variant, true);
  const folded = foldFor(variant, false);

  return (
    <>
      {/* Ink Color (desktop has these inline in the toolbar) */}
      {!isDesktop && (
        <InkFilterSection
          inkFilters={inkFilters}
          onToggleInk={onToggleInk}
          grid={isPanel}
          fold={open}
          modeSwitch={<DualInkToggle filters={filters} onFiltersChange={onFiltersChange} isMobile={isMobile} />}
          action={headerAction}
          options={buttonOptions}
        />
      )}

      {/* Inkwell (inline in Browse's toolbar on desktop; shown here otherwise).
          Above cost, because it sets which symbol the cost buttons below are
          drawn in. */}
      {showInkwellSection && (
        <InkwellFilterSection
          filters={filters}
          onFiltersChange={onFiltersChange}
          fold={open}
          options={buttonOptions}
        />
      )}

      {/* Ink Cost (inline in the toolbar on wide desktop; shown here otherwise) */}
      {showCostSection && (
        <CostFilterSection
          costFilters={costFilters}
          onToggleCost={onToggleCost}
          grid={isPanel}
          inkwell={filters.inkwell}
          fold={open}
          options={buttonOptions}
        />
      )}

      <RaritySection
        rarities={uniqueRarities}
        filters={filters}
        onFiltersChange={onFiltersChange}
        showArtPresets={showArtPresets}
        fold={open}
        isMobile={isMobile}
      />

      <TraitSections
        filters={filters}
        onFiltersChange={onFiltersChange}
        typeFilters={typeFilters}
        onToggleType={onToggleType}
        uniqueKeywords={uniqueKeywords}
        uniqueClassifications={uniqueClassifications}
        sets={sets}
        buttonOptions={buttonOptions}
        showSetFilter={showSetFilter}
        isDesktop={isDesktop}
        isMobile={isMobile}
        fold={folded}
      />
    </>
  );
}
