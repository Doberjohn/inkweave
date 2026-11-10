import {Fragment, useId, type CSSProperties, type ReactNode} from 'react';
import {CostFilterGroup} from 'inkweave-ui/lorcana/CostFilterGroup';
import {InkFilterGroup} from 'inkweave-ui/lorcana/InkFilterGroup';
import {InkwellIcon} from 'inkweave-ui/lorcana/InkwellIcon';
import {RaritySymbol} from 'inkweave-ui/lorcana/RaritySymbol';
import {picksExactly, type ArtPreset, type FilterPicks} from 'inkweave-ui/lib/filterModel';
import {hasRaritySymbol, rarityConfigOf} from 'inkweave-ui/lib/rarity';
import {Chip} from '../../../shared/components';
import {COLORS, FONT_SIZES, FONT_WEIGHT, SPACING} from '../../../shared/constants';
import {FILTER_VOCABULARY} from '../../cards/filterOptions';
import {FIELD} from './binderFields';
import {RulePick} from './RulePick';
import type {BinderDraft} from './useBinderDraft';

interface RuleLinesProps {
  draft: BinderDraft;
  isMobile: boolean;
}

/** The picks with one of them set, or left out when it is empty, as the filter panel keeps them. */
function withPick<K extends keyof FilterPicks>(picks: FilterPicks, key: K, value: FilterPicks[K]): FilterPicks {
  const next = {...picks};
  const empty = value === undefined || (Array.isArray(value) && value.length === 0);
  if (empty) delete next[key];
  else next[key] = value;
  return next;
}

/** The list with `value` added, or removed if it was there. */
const toggledIn = (values: readonly string[], value: string) =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

type DraftFilters = BinderDraft['filters'];

/** Sets one of the picks, or leaves it out when empty. */
type Update = <K extends keyof FilterPicks>(key: K, value: FilterPicks[K]) => void;

/**
 * "What it holds": one line for each kind of rule, its name on the left and its choices on the
 * right at their own size, or on a phone its name over them. Each line offers what the filter
 * panel's section offered the window, over the same draft (`useBinderDraft`'s filters), so the
 * rules it writes are the panel's: Ink with Dual-ink cards for one ink or a pair, Inkwell, Ink
 * cost in the uninkable hexagon while Uninkable is on, Rarity with its art presets, Type,
 * Classification and Keyword as dropdowns, and Name has, which matches names as the search does.
 */
export function RuleLines({draft, isMobile}: RuleLinesProps) {
  const {filters, options} = draft;
  const picks = filters.draftFilters;
  const update: Update = (key, value) => filters.updateFilters(withPick(picks, key, value));
  return (
    <div style={isMobile ? LINES_PHONE : LINES}>
      <InkLine filters={filters} update={update} isMobile={isMobile} />
      <InkwellLine picks={picks} update={update} isMobile={isMobile} />
      <Line label="Ink cost" isMobile={isMobile}>
        <CostFilterGroup
          costFilters={filters.draftCosts}
          onToggleCost={filters.toggleCost}
          iconSize={24}
          uninkable={picks.inkwell === 'uninkable'}
          style={isMobile ? COSTS_PHONE : {flexWrap: 'wrap'}}
        />
      </Line>
      <RarityLine rarities={options.rarities} picked={picks.rarities ?? []} update={update} isMobile={isMobile} />
      <TypeLine filters={filters} isMobile={isMobile} />
      <PickLine
        label="Classification"
        options={options.classifications}
        picked={picks.classifications ?? []}
        onChange={(next) => update('classifications', next)}
        isMobile={isMobile}
      />
      <PickLine
        label="Keyword"
        options={options.keywords}
        picked={picks.keywords ?? []}
        onChange={(next) => update('keywords', next)}
        isMobile={isMobile}
      />
      <NameHasLine draft={draft} isMobile={isMobile} />
    </div>
  );
}

/** The six inks, then Dual-ink cards, which narrows them to their dual-ink cards, for one ink or a pair. */
function InkLine({filters, update, isMobile}: {filters: DraftFilters; update: Update; isMobile: boolean}) {
  const dual = filters.draftFilters.inkMatch === 'dual';
  return (
    <Line label="Ink" isMobile={isMobile}>
      <InkFilterGroup inkFilters={filters.draftInks} onToggleInk={filters.toggleInk} iconSize={24} />
      {FILTER_VOCABULARY.offersDualInk(filters.draftInks.length) && (
        <Chip
          label="Dual-ink cards"
          title="Only the dual-ink cards of the selected inks"
          active={dual}
          onClick={() => update('inkMatch', dual ? undefined : 'dual')}
          isMobile={isMobile}
          style={compactChip(isMobile)}
        />
      )}
    </Line>
  );
}

const INKWELLS = [
  {value: 'inkable', label: 'Inkable'},
  {value: 'uninkable', label: 'Uninkable'},
] as const;

/** Inkable or Uninkable, each with its symbol; picking the lit one again takes it off. */
function InkwellLine({picks, update, isMobile}: {picks: FilterPicks; update: Update; isMobile: boolean}) {
  return (
    <Line label="Inkwell" isMobile={isMobile}>
      {INKWELLS.map(({value, label}) => {
        const on = picks.inkwell === value;
        return (
          <Chip key={value} label="" active={on} onClick={() => update('inkwell', on ? undefined : value)} isMobile={isMobile}>
            <span style={ICON_WORD}>
              <InkwellIcon value={value} size={16} />
              {label}
            </span>
          </Chip>
        );
      })}
    </Line>
  );
}

/** Any of the picked types: Character, Action, Song, Item and Location. */
function TypeLine({filters, isMobile}: {filters: DraftFilters; isMobile: boolean}) {
  return (
    <Line label="Type" isMobile={isMobile}>
      {FILTER_VOCABULARY.allButtons.types.map((type) => (
        <Chip
          key={type}
          label={type}
          active={filters.draftTypes.includes(type)}
          onClick={() => filters.toggleType(type)}
          isMobile={isMobile}
        />
      ))}
    </Line>
  );
}

/** One kind's line: a group named by its name, its choices packed from the start and wrapping. */
function Line({label, isMobile, children}: {label: string; isMobile: boolean; children: ReactNode}) {
  const nameId = useId();
  return (
    <div role="group" aria-labelledby={nameId} style={isMobile ? STACKED : SIDE_BY_SIDE}>
      <span id={nameId} style={LABEL}>
        {label}
      </span>
      <div style={CHOICES}>{children}</div>
    </div>
  );
}

/** Classification or Keyword: its dropdown, left out when the pool offers none and none is picked. */
function PickLine(props: {label: string; options: string[]; picked: string[]; onChange: (next: string[]) => void; isMobile: boolean}) {
  if (props.options.length === 0 && props.picked.length === 0) return null;
  return (
    <Line label={props.label} isMobile={props.isMobile}>
      <div style={{flex: 1, minWidth: 0}}>
        <RulePick {...props} />
      </div>
    </Line>
  );
}

/** Whether the rarity at `i` is the first of the printings (Epic and after), after the card rarities. */
const startsPrintings = (rarities: readonly string[], i: number) =>
  i > 0 && !rarityConfigOf(rarities[i]) && rarityConfigOf(rarities[i - 1]) !== undefined;

/** Whether the art presets mean anything here: each picks some of the offered rarities. */
const offersEveryKind = (presets: readonly ArtPreset[]) =>
  presets.length > 0 && presets.every((preset) => preset.rarities.length > 0);

/**
 * The rarities as their symbols, named for the screen reader and the tooltip (Promo for Special),
 * then the art presets where they mean something: Standard cards and Alt art cards each pick one
 * kind of rarity, replacing the others, and light while the picks are exactly theirs. On a phone
 * the printings' symbols start a line of their own, as in the filter panel. No line for Sets
 * that offer no rarity (promos alone).
 */
function RarityLine({rarities, picked, update, isMobile}: {
  rarities: string[];
  picked: string[];
  update: Update;
  isMobile: boolean;
}) {
  if (rarities.length === 0) return null;
  const presets = FILTER_VOCABULARY.artPresets(rarities);
  const pick = (next: string[]) => update('rarities', next);
  return (
    <Line label="Rarity" isMobile={isMobile}>
      {rarities.map((rarity, i) => (
        <Fragment key={rarity}>
          {isMobile && startsPrintings(rarities, i) && <span aria-hidden style={LINE_BREAK} />}
          <Chip
            label={FILTER_VOCABULARY.rarityLabel(rarity)}
            icon={hasRaritySymbol(rarity) ? <RaritySymbol rarity={rarity.toLowerCase()} size={20} /> : undefined}
            active={picked.includes(rarity)}
            onClick={() => pick(toggledIn(picked, rarity))}
            isMobile={isMobile}
          />
        </Fragment>
      ))}
      {offersEveryKind(presets) && <ArtPresets presets={presets} picked={picked} onPick={pick} isMobile={isMobile} />}
    </Line>
  );
}

/** Standard cards and Alt art cards, on a line of their own under the symbols. */
function ArtPresets({presets, picked, onPick, isMobile}: {
  presets: readonly ArtPreset[];
  picked: string[];
  onPick: (next: string[]) => void;
  isMobile: boolean;
}) {
  return (
    <div role="group" aria-label="Card art" style={PRESETS}>
      {presets.map((preset) => {
        const lit = picksExactly(picked, preset.rarities);
        return (
          <Chip
            key={preset.value}
            label={preset.label}
            title={preset.title}
            active={lit}
            onClick={() => onPick(lit ? [] : [...preset.rarities])}
            isMobile={isMobile}
            style={compactChip(isMobile)}
          />
        );
      })}
    </div>
  );
}

/** Name has: matches names as the search box does. Only a long one can write rules past what the table holds. */
function NameHasLine({draft, isMobile}: {draft: BinderDraft; isMobile: boolean}) {
  const fieldId = useId();
  return (
    <div style={isMobile ? STACKED : SIDE_BY_SIDE}>
      <label htmlFor={fieldId} style={LABEL}>
        Name has
      </label>
      <div style={{minWidth: 0}}>
        <input
          id={fieldId}
          placeholder="Stitch"
          autoComplete="off"
          value={draft.query}
          onChange={(event) => draft.setQuery(event.target.value)}
          style={isMobile ? FIELD : NAME_FIELD}
        />
        {draft.rulesTooLong && (
          <p role="status" style={TOO_LONG}>
            These rules are too long to keep. Shorten Name has.
          </p>
        )}
      </div>
    </div>
  );
}

/** The names' column on a computer: wide enough for "Classification", so every line's choices start together. */
const NAME_COLUMN = '7.5rem';

const SIDE_BY_SIDE: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `${NAME_COLUMN} minmax(0, 1fr)`,
  alignItems: 'center',
  columnGap: SPACING.lg,
};

const STACKED: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.sm};

const LABEL: CSSProperties = {fontSize: `${FONT_SIZES.base}px`, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textMuted};

const CHOICES: CSSProperties = {display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: SPACING.sm, minWidth: 0};

/**
 * The small chips beside full-size choices on a computer, Dual-ink cards and the art presets; the
 * kit's touch size on a phone.
 */
const compactChip = (isMobile: boolean): CSSProperties | undefined =>
  isMobile ? undefined : {padding: `${SPACING.xxs}px ${SPACING.md}px`, fontSize: `${FONT_SIZES.sm}px`};

const LINES: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.md};

const LINES_PHONE: CSSProperties = {...LINES, gap: SPACING.lg};

const ICON_WORD: CSSProperties = {display: 'inline-flex', alignItems: 'center', gap: SPACING.xs};

/** A zero-height item a full line wide: what follows it starts a new line. */
const LINE_BREAK: CSSProperties = {flexBasis: '100%', height: 0};

/** The art presets take a line of their own under the symbols. */
const PRESETS: CSSProperties = {display: 'flex', flexWrap: 'wrap', gap: SPACING.sm, flexBasis: '100%'};

/** On a phone the nine costs take two even rows, five and four, rather than seven and two. */
const COSTS_PHONE: CSSProperties = {display: 'grid', gridTemplateColumns: 'repeat(5, max-content)', gap: SPACING.sm};

/** Name has on a computer: no taller than the dropdowns beside it. */
const NAME_FIELD: CSSProperties = {...FIELD, padding: `${SPACING.xs}px ${SPACING.sm}px`};

const TOO_LONG: CSSProperties = {margin: `${SPACING.xs}px 0 0`, fontSize: `${FONT_SIZES.base}px`, color: COLORS.error};
