import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {DeckStats} from '../types';
import {DeckCardRow} from './DeckCardRow';
import {CostCurveStrip} from './CostCurveStrip';
import {totalCopies} from './costCurveColumns';
import {previewGeometry} from './previewGeometry';
import {DeckProfile} from './DeckProfile';
import {TabList} from '../../../shared/components/TabList';
import {COLORS, EASING, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING, Z_INDEX, blackRgba} from '../../../shared/constants';

/** Competitive Core deck size — the count badge + progress bar target. */
const DECK_TARGET = 60;

/** Fixed height (px) of the stats row. Fixed rather than content-driven so switching
 *  tabs never reflows the card list under it, and the curve chart has room to breathe. */
const STATS_ROW_HEIGHT = 240;

/** Which stats view the panel's tab strip is showing. */
type StatsTab = 'curve' | 'profile';

function CurveIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3s6 6.3 6 10a6 6 0 0 1-12 0c0-3.7 6-10 6-10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

const STATS_TABS: ReadonlyArray<{id: StatsTab; label: string; icon: ReactNode}> = [
  {id: 'curve', label: 'Cost curve', icon: <CurveIcon />},
  {id: 'profile', label: 'Profile', icon: <ProfileIcon />},
];

/** A resolved deck line: the card plus how many copies are in the deck. */
export interface DeckRow {
  card: LorcanaCard;
  quantity: number;
  /** Whether this line is flagged a deck-core anchor (weights suggestions ×2). */
  isCore?: boolean;
}

interface DeckPanelProps {
  name: string;
  onRename: (name: string) => void;
  /** Rows pre-resolved + sorted by the page (cost, then name). */
  rows: DeckRow[];
  stats: DeckStats;
  onIncrement: (cardId: string) => void;
  /** Removes a copy; the last one drops the card (setCardQuantity at 0). */
  onDecrement: (cardId: string) => void;
  /** Flags/unflags a card as a deck-core anchor (mirrors DeckContext.markCore). */
  onSetCore?: (cardId: string, isCore: boolean) => void;
  /** Deck-level toolbar (Clear / Import / Export), rendered under the deck header. */
  actions?: ReactNode;
  /**
   * Clicking a row's thumbnail/name opens that card's detail modal. `siblingIds` is
   * the deck in the panel's VISUAL (type-grouped) order, so the modal's arrow-nav
   * walks the deck as rendered rather than the page's flat cost-then-name sort.
   */
  onOpenDetails?: (card: LorcanaCard, siblingIds: string[]) => void;
}

// Songs are pulled out of Actions into their own group. `card.isSong` is the
// reliable flag — the isSong() helper misses transformed cards (their 'Song'
// subtype is moved off `classifications` onto this boolean at load time).
type RowGroup = 'Character' | 'Action' | 'Song' | 'Item' | 'Location';
const GROUP_ORDER: RowGroup[] = ['Character', 'Action', 'Song', 'Item', 'Location'];
const GROUP_LABEL: Record<RowGroup, string> = {
  Character: 'Characters',
  Action: 'Actions',
  Song: 'Songs',
  Item: 'Items',
  Location: 'Locations',
};

function rowGroup(card: LorcanaCard): RowGroup {
  return card.isSong ? 'Song' : card.type;
}

/**
 * The deck's card count, colored by legality — the one figure worth a permanent
 * slot in the header (it is checked after every add). The rest of the old info
 * strip (ink symbols, inkable/uninkable) moved into the Profile tab.
 */
function DeckCardCount({stats}: {stats: DeckStats}) {
  const reached = stats.totalCards >= DECK_TARGET;
  const countColor = stats.isLegal ? COLORS.primary : reached ? COLORS.error : COLORS.text;
  return (
    <span
      style={{
        flexShrink: 0,
        whiteSpace: 'nowrap',
        color: countColor,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.lg}px`,
        fontWeight: 700,
      }}>
      {stats.totalCards} <span style={{color: COLORS.textMuted, fontWeight: 500}}>cards</span>
    </span>
  );
}

/**
 * Deck name field — pencil-to-edit (#472). Shows the deck name as a heading with a
 * pencil affordance; clicking swaps to a focused input that commits on Enter/blur. The
 * renamed heading shown back IS the "it saved" feedback (the rename auto-persists).
 */
/**
 * The rename input. Mounted only while editing, so it focuses on mount instead of
 * guarding a shared effect on an `editing` flag. `onDone` reports whether the name
 * was actually edited, which is what drives the transient "Renamed" note.
 */
function DeckNameInput({
  name,
  onRename,
  onDone,
}: {
  name: string;
  onRename: (name: string) => void;
  onDone: (changed: boolean) => void;
}) {
  const dirty = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <input
      ref={inputRef}
      aria-label="Deck name"
      value={name}
      onChange={(e) => {
        onRename(e.target.value);
        dirty.current = true;
      }}
      onBlur={() => onDone(dirty.current)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
      }}
      placeholder="Untitled deck"
      style={{
        flex: 1,
        minWidth: 0,
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.primary}`,
        borderRadius: RADIUS.sm,
        outline: 'none',
        padding: '2px 8px',
        color: COLORS.text,
        fontFamily: FONTS.hero,
        fontSize: `${FONT_SIZES.xxl}px`,
      }}
    />
  );
}

/** Resting state: the deck name, a pencil affordance, and the transient saved note. */
function DeckNameButton({name, justSaved, onEdit}: {name: string; justSaved: boolean; onEdit: () => void}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onEdit}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Rename deck"
      title="Rename deck"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
      }}>
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: name ? COLORS.text : COLORS.textDim,
          fontFamily: FONTS.hero,
          fontSize: `${FONT_SIZES.xxl}px`,
        }}>
        {name || 'Untitled deck'}
      </span>
      <svg
        aria-hidden
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke={hover ? COLORS.primary : COLORS.textDim}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{flexShrink: 0, transition: `stroke 0.15s ${EASING.snappy}`}}>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
      {justSaved && (
        <span
          role="status"
          style={{
            flexShrink: 0,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.sm}px`,
            fontWeight: 700,
            color: COLORS.primary,
            whiteSpace: 'nowrap',
          }}>
          ✓ Renamed
        </span>
      )}
    </button>
  );
}

/** Owns the edit/rest mode switch. The saved-note timer lives here rather than in
 *  the input, since the note must outlive the input's unmount on blur. */
function DeckNameField({name, onRename}: {name: string; onRename: (name: string) => void}) {
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1900);
    return () => clearTimeout(t);
  }, [justSaved]);

  if (editing) {
    return (
      <DeckNameInput
        name={name}
        onRename={onRename}
        onDone={(changed) => {
          setEditing(false);
          if (changed) setJustSaved(true);
        }}
      />
    );
  }
  return <DeckNameButton name={name} justSaved={justSaved} onEdit={() => setEditing(true)} />;
}

/**
 * Real rule violations only. The header count badge already tracks deck size
 * (e.g. 44/60), so the "still under 60 cards" shortfall (`(minimum 60)`) is
 * filtered out — otherwise the strip would nag for the whole build. What's left
 * is the genuine problems the badge's color can't explain: too many copies / inks.
 */
function ruleViolations(errors: string[]): string[] {
  return errors.filter((e) => !e.includes('(minimum '));
}

/**
 * Legality problems, surfaced only when there's something to fix. Stays quiet
 * (renders nothing) for a legal deck or a deck that's merely still being built —
 * the redundant progress bar + "Core legal" happy-state were dropped in favor of
 * the header count badge, which already conveys size + legal state.
 */
function LegalityErrors({stats}: {stats: DeckStats}) {
  const problems = ruleViolations(stats.legalityErrors);
  if (problems.length === 0) return null;

  return (
    <div style={{padding: SPACING.md, borderTop: `1px solid ${COLORS.surfaceBorder}`, flexShrink: 0}}>
      <div style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.md}px`, fontWeight: 700, color: COLORS.error}}>
        Not Core legal
      </div>
      {problems.map((err) => (
        <div
          key={err}
          style={{marginTop: 4, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.md}px`, color: COLORS.textMuted}}>
          • {err}
        </div>
      ))}
    </div>
  );
}

// The hover preview: a full card floated to the LEFT of the hovered row, portaled
// to <body> so the panel's overflow can't clip it. pointer-events:none so it never
// steals the hover that spawned it.
function FloatingPreview({card, anchor}: {card: LorcanaCard; anchor: DOMRect}) {
  const geometry = previewGeometry(anchor, window.innerHeight);
  if (!geometry) return null;
  const {width, left, top} = geometry;
  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top,
        left,
        width,
        borderRadius: RADIUS.card,
        overflow: 'hidden',
        border: `2px solid ${INK_COLORS[card.ink].border}`,
        boxShadow: `0 16px 48px ${blackRgba(0.6)}`,
        pointerEvents: 'none',
        zIndex: Z_INDEX.popover,
        animation: `inkweave-row-enter 0.18s ${EASING.smooth}`,
      }}>
      <img src={card.imageUrl} alt="" style={{width: '100%', display: 'block'}} />
    </div>,
    document.body,
  );
}

const groupHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.sm,
  padding: '12px 8px 4px',
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.md}px`,
  fontWeight: 700,
  color: COLORS.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

/**
 * The right-hand deck pane: an inline-editable name + count badge, Cards / Analysis
 * tabs, the type-grouped list of {@link DeckCardRow}s (with a floating hover
 * preview), and a persistent legality/progress footer. Purely prop-driven
 * (resolved rows + {@link DeckStats}); all mutations route back through the page's
 * useDeck actions. Removal is deferred so the row can collapse out first.
 */
export function DeckPanel({name, onRename, rows, stats, onIncrement, onDecrement, onSetCore, actions, onOpenDetails}: DeckPanelProps) {
  const [statsTab, setStatsTab] = useState<StatsTab>('curve');
  const [peek, setPeek] = useState<{card: LorcanaCard; anchor: DOMRect} | null>(null);

  /** The deck's card ids in the order the panel renders them (grouped by type). */
  const orderedCardIds = () =>
    GROUP_ORDER.flatMap((g) => rows.filter((r) => rowGroup(r.card) === g).map((r) => r.card.id));

  const openDetails = (clicked: LorcanaCard) => {
    setPeek(null); // the modal covers the panel; don't leave a preview floating behind it
    onOpenDetails?.(clicked, orderedCardIds());
  };

  const renderRow = ({card, quantity, isCore}: DeckRow) => (
    <DeckCardRow
      key={card.id}
      card={card}
      quantity={quantity}
      onIncrement={() => onIncrement(card.id)}
      onDecrement={() => onDecrement(card.id)}
      isCore={isCore}
      onSetCore={onSetCore ? () => onSetCore(card.id, !isCore) : undefined}
      onPreviewEnter={(previewCard, anchor) => setPeek({card: previewCard, anchor})}
      onPreviewLeave={() => setPeek(null)}
      onOpenDetails={openDetails}
    />
  );

  return (
    <aside
      aria-label="Your deck"
      onMouseLeave={() => setPeek(null)}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: COLORS.surface,
        borderLeft: `1px solid ${COLORS.surfaceBorder}`,
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          padding: SPACING.md,
          borderBottom: `1px solid ${COLORS.surfaceBorder}`,
          flexShrink: 0,
        }}>
        <DeckNameField name={name} onRename={onRename} />
        <DeckCardCount stats={stats} />
        {actions}
      </div>

      {totalCopies(stats.costCurve) > 0 && (
        <div style={{display: 'flex', height: STATS_ROW_HEIGHT, flexShrink: 0, borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
          {/* Left cell: the deck's makeup, tabbed — the curve chart and the
              ink/inkable/type profile that used to crowd the header row. */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              borderRight: `1px solid ${COLORS.surfaceBorder}`,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}>
            <TabList tabs={STATS_TABS} active={statsTab} onChange={setStatsTab} ariaLabel="Deck stats views" />
            <div style={{flex: 1, minHeight: 0, overflowY: 'auto'}}>
              {statsTab === 'curve' ? (
                <CostCurveStrip costCurve={stats.costCurve} costCurveByInk={stats.costCurveByInk} />
              ) : (
                <DeckProfile stats={stats} />
              )}
            </div>
          </div>
          {/* Reserved: the deck-health cell lived here until the numeric advisor was
              pulled (it led with a 0-100 score). Left empty on purpose until we know
              what belongs in this slot — a rejected placeholder is worse than space. */}
          <div style={{flex: 1, minWidth: 0}} />
        </div>
      )}

      <div style={{flex: 1, minHeight: 0, overflowY: 'auto'}}>
        {rows.length === 0 ? (
          <p
            style={{
              padding: SPACING.lg,
              textAlign: 'center',
              color: COLORS.textMuted,
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.base}px`,
            }}>
            No cards yet. Click cards in the pool to add them.
          </p>
        ) : (
          <div style={{padding: `${SPACING.sm}px 4px`}}>
            {GROUP_ORDER.map((g) => {
              const groupRows = rows.filter((r) => rowGroup(r.card) === g);
              if (groupRows.length === 0) return null; // hide empty type groups
              const count = groupRows.reduce((n, r) => n + r.quantity, 0);
              return (
                <div key={g}>
                  <div style={groupHeader}>
                    {GROUP_LABEL[g]}
                    <span style={{color: COLORS.textDim, fontWeight: 600}}>{count}</span>
                  </div>
                  {groupRows.map(renderRow)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LegalityErrors stats={stats} />
      {peek && <FloatingPreview card={peek.card} anchor={peek.anchor} />}
    </aside>
  );
}
