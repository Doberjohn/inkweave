import Skeleton from 'react-loading-skeleton';
import {CtaButton} from '../../../shared/components';
import {useHover} from 'inkweave-ui/hooks/useHover';
import {trackEvent} from '../../../shared/lib/analytics';
import {COLORS, FONT_SIZES, SPACING, TRUNCATE, VISUALLY_HIDDEN} from '../../../shared/constants';
import {isFinished, percentOf} from '../collectionStats';
import {optionStyle, percentStyle} from '../pickerRowLook';
import type {BinderChoices} from './binderChoices';
import {binderFace, type BinderFigures} from './binderCovers';
import {ruleKinds, type Binder} from './binderRules';
import {BinderMedal} from './BinderMedal';
import {coverDesign, type CoverDesign} from './coverDesigns';
import {MY_COLLECTION, SHELF_FULL_LINE, SHELF_MAX, binderWord, shelfCount} from './shelfWords';

/** The medal's size in a row: the set rows' number column holds it. */
const ROW_MEDAL = 24;

/** One row of the Binders tab: My collection (no binder) or a binder of your own. */
interface BinderRow {
  binder: Binder | null;
  name: string;
  /** Its cover's design, or none while My collection's is still to be read. */
  cover: CoverDesign | null;
  /** Its numbers, once the pool is in. */
  figures?: BinderFigures;
}

/** My collection, then each binder in shelf order, each with its cover, and its numbers once the pool is in. */
function rowsOf({shelf, pool, entries}: BinderChoices): BinderRow[] {
  const myCover = shelf.myCollection?.cover ?? null;
  const rowOf = (binder: Binder | null): BinderRow => ({
    binder,
    name: binder?.name ?? MY_COLLECTION,
    cover: coverDesign(binder === null ? myCover : binder.cover),
    figures: pool === null ? undefined : binderFace(pool, entries, binder, myCover).figures,
  });
  const rows = [rowOf(null), ...shelf.binders.map(rowOf)];
  // My collection's cover is the shelf's to name, so its medal waits for the read rather than swap.
  if (shelf.status === 'loading' || shelf.status === 'idle') rows[0] = {...rows[0], cover: null};
  return rows;
}

interface BinderListProps {
  choices: BinderChoices;
  /** Closes the menu once a row is pressed. */
  onPicked: () => void;
}

/**
 * The set picker's Binders tab (#1074, 3A): All your binders, which opens the shelf, then My
 * collection, then each binder of your own with its cover's medal, its name and its Complete
 * percentage, the open one chosen, then New binder. A press opens it with the page's filters cleared
 * (`openBinderParams`), and counts once (`binder_opened`, the kinds of its rules, never its
 * name). Pressing the open binder at its own Sets only closes the menu.
 *
 * Its rows carry `ph-no-capture`, and each takes its name from its words, so no binder's name
 * reaches an attribute or PostHog's autocapture.
 */
export function BinderList({choices, onPicked}: BinderListProps) {
  const openId = choices.open?.binder.id ?? null;
  const pick = (binder: Binder | null) => {
    if ((binder?.id ?? null) !== openId || !choices.atOwnScope) {
      trackEvent('binder_opened', {from: 'picker', mine: binder !== null, kinds: binder ? ruleKinds(binder) : 'none'});
      choices.onOpen(binder);
    }
    onPicked();
  };
  return (
    <div role="listbox" aria-label="Binders" tabIndex={-1} style={LIST_STYLE}>
      <ShelfOption choices={choices} onPicked={onPicked} />
      {rowsOf(choices).map((row) => (
        <BinderOption key={row.binder?.id ?? ''} row={row} selected={(row.binder?.id ?? null) === openId} onPick={pick} />
      ))}
      <NewBinderOption choices={choices} onPicked={onPicked} />
      <ShelfState choices={choices} />
    </div>
  );
}

const LIST_STYLE = {
  minHeight: 0,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.xxs,
} as const;

/** Under My collection while the binders load, a row's shimmer; if they failed, a line and its Try again. */
function ShelfState({choices}: {choices: BinderChoices}) {
  const {status, retry} = choices.shelf;
  if (status === 'loading' || status === 'idle') {
    return (
      <div aria-hidden="true" style={{padding: `${SPACING.sm}px ${SPACING.xs}px`}}>
        <Skeleton height={20} />
      </div>
    );
  }
  if (status !== 'failed') return null;
  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, padding: SPACING.xs}}>
      <span role="status" style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`}}>
        Couldn&apos;t load your binders.
      </span>
      <CtaButton variant="ghost" onClick={retry}>
        Try again
      </CtaButton>
    </div>
  );
}

/** The shelf's glyph in the medal column: covers side by side, as the shelf shows them. */
function ShelfGlyph() {
  return (
    <svg width={ROW_MEDAL} height={ROW_MEDAL} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="7.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="4" width="7.5" height="9.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 18h18M3 20.5h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * All your binders (#1074), above My collection: back to the shelf, with its count, My collection
 * included, once the binders have loaded. Never chosen: the shelf is never what the picker names.
 */
function ShelfOption({choices, onPicked}: BinderListProps) {
  const {hovered, hoverProps} = useHover();
  const count = shelfCount(choices.shelf);
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      role="option"
      aria-selected={false}
      tabIndex={-1}
      className="ph-no-capture"
      onClick={() => {
        choices.onShelf();
        onPicked();
      }}
      style={optionStyle({on: false, hovered})}>
      <span aria-hidden="true" style={{display: 'flex', justifyContent: 'center', color: COLORS.primary}}>
        <ShelfGlyph />
      </span>
      <span aria-hidden="true" style={TRUNCATE}>
        All your binders
      </span>
      {count !== null && (
        <span aria-hidden="true" style={percentStyle(false)}>
          {count}
        </span>
      )}
      <span style={VISUALLY_HIDDEN}>{count === null ? 'All your binders' : `All your binders, ${count} ${binderWord(count)}`}</span>
    </CtaButton>
  );
}

/** The + in the medal column. */
function PlusGlyph() {
  return (
    <svg width={ROW_MEDAL} height={ROW_MEDAL} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const FULL_LINE = {
  margin: 0,
  padding: `${SPACING.sm}px ${SPACING.xs}px`,
  fontSize: `${FONT_SIZES.base}px`,
  color: COLORS.textMuted,
} as const;

/**
 * New binder, under the binders once they have read: the menu closes and the window
 * opens, and a binder made there opens. At 30 binders, the line that says why there is no other.
 */
function NewBinderOption({choices, onPicked}: BinderListProps) {
  const {hovered, hoverProps} = useHover();
  const {onNewBinder, shelf} = choices;
  if (onNewBinder === null || shelf.status !== 'ready') return null;
  if (shelf.binders.length >= SHELF_MAX) return <p style={FULL_LINE}>{SHELF_FULL_LINE}</p>;
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      role="option"
      aria-selected={false}
      tabIndex={-1}
      className="ph-no-capture"
      onClick={() => {
        onPicked();
        onNewBinder();
      }}
      style={optionStyle({on: false, hovered})}>
      <span aria-hidden="true" style={{display: 'flex', justifyContent: 'center', color: COLORS.primary}}>
        <PlusGlyph />
      </span>
      <span style={TRUNCATE}>New binder</span>
    </CtaButton>
  );
}

/** What a row says of its numbers: a percentage, or a dash for a binder whose rules hold no card. */
function percentText({complete, cards}: BinderFigures): {shown: string; spoken: string} {
  if (cards === 0) return {shown: '–', spoken: 'no cards'};
  const percent = percentOf(complete, cards);
  return {shown: `${percent}%`, spoken: `${percent}% complete`};
}

interface BinderOptionProps {
  row: BinderRow;
  selected: boolean;
  onPick: (binder: Binder | null) => void;
}

/**
 * One binder in the list: its medal, its name, and how complete it is.
 *
 * NAMED BY ONE SCREEN-READER-ONLY LINE, with the drawn words hidden from screen readers, as the
 * phone row's button is (`RowLabel`): a browser joins a row's spans with spaces, so the name
 * would read "Amber , 100% complete", and an `aria-label` would put the player's own words in an
 * attribute. The hidden line holds the drawn name, as WCAG 2.5.3 asks.
 */
function BinderOption({row, selected, onPick}: BinderOptionProps) {
  const {hovered, hoverProps} = useHover();
  const text = row.figures ? percentText(row.figures) : null;
  return (
    <CtaButton
      variant="neutral"
      {...hoverProps}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      className="ph-no-capture"
      onClick={() => onPick(row.binder)}
      style={optionStyle({on: selected, hovered})}>
      <span aria-hidden="true" style={{display: 'flex', justifyContent: 'center'}}>
        <BinderMedal design={row.cover} size={ROW_MEDAL} />
      </span>
      <span aria-hidden="true" style={TRUNCATE}>
        {row.name}
      </span>
      {row.figures && text && (
        <span aria-hidden="true" style={percentStyle(isFinished(row.figures.complete, row.figures.cards))}>
          {text.shown}
        </span>
      )}
      <span style={VISUALLY_HIDDEN}>{`${row.name}${text ? `, ${text.spoken}` : ''}`}</span>
    </CtaButton>
  );
}
