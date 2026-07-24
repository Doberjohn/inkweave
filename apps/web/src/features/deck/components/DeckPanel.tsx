import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {Archetype, DeckStats} from '../types';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import {DeckCardRow} from './DeckCardRow';
import {CostCurveStrip} from './CostCurveStrip';
import {TypeSplitPips} from './TypeSplitPips';
import {totalCopies} from './costCurveColumns';
import {HealthSummary} from './HealthSummary';
import {type HealthVariant} from './HealthVariants';
import {SortSelect} from '../../../shared/components/SortSelect';
import {TabList} from '../../../shared/components/TabList';
import {DeckAdvisorPanel} from './DeckAdvisorPanel';
import {previewGeometry} from './previewGeometry';
import {ALL_INKS, COLORS, EASING, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING, Z_INDEX, blackRgba} from '../../../shared/constants';
import {InkIcon} from '../../../shared/components/InkIcon';
import {InkwellIcon} from '../../../shared/components/InkwellIcon';

/** Competitive Core deck size — the count badge + progress bar target. */
const DECK_TARGET = 60;

/** Fixed height (px) of the Cards-tab cost-curve + health row (#472). Fixed rather
 *  than content-driven so the cost-curve chart has room to breathe (Option C). */
const STATS_ROW_HEIGHT = 240;

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
  onDecrement: (cardId: string) => void;
  onRemove: (cardId: string) => void;
  /** Flags/unflags a card as a deck-core anchor (mirrors DeckContext.markCore). */
  onSetCore?: (cardId: string, isCore: boolean) => void;
  /**
   * Clicking a row's thumbnail/name opens that card's detail modal. `siblingIds` is
   * the deck in the panel's VISUAL (type-grouped) order, so the modal's arrow-nav
   * walks the deck as rendered rather than the page's flat cost-then-name sort.
   */
  onOpenDetails?: (card: LorcanaCard, siblingIds: string[]) => void;
  /** Live advisor result for the Analysis tab (null until the deck has cards + the first run lands). */
  analysis?: DeckAnalysis | null;
  /** True while the advisor is (re)computing. */
  analysisLoading?: boolean;
  /** Set when the advisor pipeline failed; surfaced as an "unavailable" state. */
  analysisError?: Error | null;
  /** The deck's declared gameplan (undefined = auto-detect); drives the advisor's selector. */
  gameplan?: Archetype;
  /** Writes `deck.gameplan`; undefined clears the declaration back to auto-detect. */
  onGameplanChange?: (gameplan: Archetype | undefined) => void;
}

type PanelTab = 'cards' | 'analysis';

const TAB_DEFS: ReadonlyArray<{id: PanelTab; label: string}> = [
  {id: 'cards', label: 'Cards'},
  {id: 'analysis', label: 'Analysis'},
];

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

// Advisor zones still dashed. The Deck Quality Score renders via <ScoreGauge> and
// vulnerabilities via <VulnerabilityBox> (#472). Cost curve / ink balance were dropped
// as duplicates of the Cards-tab strip. Synergies & suggestions belong to a SEPARATE
// task (#471), labelled as such so the tab doesn't imply #472 owns them.
const PENDING_ADVISOR_ZONES = [
  'Synergies & key cards · coming soon',
  'Suggestions · coming soon',
];

/**
 * Duels.ink-style deck info: the deck's ink symbols, total card count (colored by
 * legality), and inkable / uninkable counts. Replaces the old N/60 count badge.
 * Uses the shared InkIcon / InkwellIcon assets (per-ink SVGs + inkwell symbols).
 */
function DeckInfoStrip({stats}: {stats: DeckStats}) {
  const inks = ALL_INKS.filter((ink) => (stats.inkDistribution[ink] ?? 0) > 0);
  const reached = stats.totalCards >= DECK_TARGET;
  const countColor = stats.isLegal ? COLORS.primary : reached ? COLORS.error : COLORS.text;
  const uninkable = stats.totalCards - stats.inkableCount;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.lg}px`}}>
      {inks.length > 0 && (
        <div style={{display: 'flex', gap: 3}}>
          {inks.map((ink) => (
            <InkIcon key={ink} ink={ink} size={20} />
          ))}
        </div>
      )}
      <span style={{color: countColor, fontWeight: 700, whiteSpace: 'nowrap'}}>
        {stats.totalCards} <span style={{color: COLORS.textMuted, fontWeight: 500}}>cards</span>
      </span>
      <span title="Inkable cards" style={{display: 'flex', alignItems: 'center', gap: 4, color: COLORS.textMuted}}>
        <InkwellIcon value="inkable" size={20} />
        {stats.inkableCount}
      </span>
      <span title="Uninkable cards" style={{display: 'flex', alignItems: 'center', gap: 4, color: COLORS.textMuted}}>
        <InkwellIcon value="uninkable" size={20} />
        {uninkable}
      </span>
    </div>
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

function AnalysisTab({
  analysis,
  isLoading,
  error,
  gameplan,
  onGameplanChange,
}: {
  analysis: DeckAnalysis | null;
  isLoading: boolean;
  error: Error | null;
  gameplan: Archetype | undefined;
  onGameplanChange: (gameplan: Archetype | undefined) => void;
}) {
  return (
    <div style={{padding: SPACING.md, display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
      <DeckAdvisorPanel
        analysis={analysis}
        isLoading={isLoading}
        error={error}
        gameplan={gameplan}
        onGameplanChange={onGameplanChange}
      />
      {PENDING_ADVISOR_ZONES.map((zone) => (
        <div
          key={zone}
          style={{border: `1px dashed ${COLORS.surfaceBorder}`, borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.textDim, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`}}>
          {zone}
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
const HEALTH_VARIANT_KEY = 'inkweave:healthVariant';
/** Health-cell lenses (#472). Priorities is the default: its sub-rings explain the score. */
const HEALTH_VARIANT_OPTIONS: {value: HealthVariant; label: string}[] = [
  {value: 'priorities', label: 'Priorities'},
  {value: 'vitals', label: 'Vitals'},
  {value: 'radar', label: 'Radar'},
];

/** Narrows a persisted string, using the options list as the single source of truth
 *  so adding a lens does not need a second literal union kept in sync by hand. */
function isHealthVariant(value: string | null): value is HealthVariant {
  return HEALTH_VARIANT_OPTIONS.some((o) => o.value === value);
}

function readHealthVariant(): HealthVariant {
  try {
    const stored = localStorage.getItem(HEALTH_VARIANT_KEY);
    if (isHealthVariant(stored)) return stored;
  } catch {
    // localStorage may be unavailable (private mode); fall back to the default.
  }
  return 'priorities';
}

export function DeckPanel({name, onRename, rows, stats, onIncrement, onDecrement, onRemove, onSetCore, onOpenDetails, analysis, analysisLoading, analysisError, gameplan, onGameplanChange}: DeckPanelProps) {
  const [tab, setTab] = useState<PanelTab>('cards');
  const [healthVariant, setHealthVariant] = useState<HealthVariant>(readHealthVariant);
  const updateHealthVariant = (v: HealthVariant) => {
    setHealthVariant(v);
    try {
      localStorage.setItem(HEALTH_VARIANT_KEY, v);
    } catch {
      // ignore persistence failure
    }
  };
  // cardId -> the quantity snapshot when trash was clicked. The row collapses out,
  // then the real removal completes on transitionEnd — but only if the quantity
  // hasn't changed under us in the meantime (the user could re-increment via the
  // pool tile mid-collapse), in which case the removal is aborted.
  const [leaving, setLeaving] = useState<Record<string, number>>({});
  const [peek, setPeek] = useState<{card: LorcanaCard; anchor: DOMRect} | null>(null);

  const requestRemove = (cardId: string, snapshot: number) => {
    setLeaving((l) => ({...l, [cardId]: snapshot}));
    // Drop a preview still pinned to the card being removed.
    setPeek((p) => (p?.card.id === cardId ? null : p));
  };
  const finishRemove = (cardId: string, currentQuantity: number) => {
    const snapshot = leaving[cardId];
    setLeaving((l) => {
      const next = {...l};
      delete next[cardId];
      return next;
    });
    if (snapshot === currentQuantity) onRemove(cardId);
  };

  /**
   * Commit every staged removal whose quantity hasn't changed under us. This is the
   * same abort rule finishRemove applies, so a mid-collapse re-increment keeps the
   * card whichever way the collapse ends.
   */
  const flushLeaving = () => {
    const currentQuantities = new Map(rows.map((r) => [r.card.id, r.quantity]));
    Object.entries(leaving).forEach(([cardId, snapshot]) => {
      if (currentQuantities.get(cardId) === snapshot) onRemove(cardId);
    });
  };

  // A removal only commits on transitionEnd, and transitionEnd never fires if the
  // row unmounts first: navigate away mid-collapse and the row vanishes visually
  // while the card stays in the (longer-lived) DeckProvider, reappearing later.
  // Every exit needs a flush; switchTab has one, so unmount needs one too.
  const flushOnUnmount = useRef<() => void>(() => {});
  useEffect(() => {
    flushOnUnmount.current = flushLeaving;
  });
  useEffect(() => () => flushOnUnmount.current(), []);

  /** The deck's card ids in the order the panel renders them (grouped by type). */
  const orderedCardIds = () =>
    GROUP_ORDER.flatMap((g) => rows.filter((r) => rowGroup(r.card) === g).map((r) => r.card.id));

  const openDetails = (clicked: LorcanaCard) => {
    setPeek(null); // the modal covers the panel; don't leave a preview floating behind it
    onOpenDetails?.(clicked, orderedCardIds());
  };

  const switchTab = (next: PanelTab) => {
    // Switching tabs unmounts the rows, so an in-flight collapse would never fire
    // its transitionEnd. Flush first so nothing gets stuck.
    flushLeaving();
    setLeaving({});
    setTab(next);
    setPeek(null);
  };

  const renderRow = ({card, quantity, isCore}: DeckRow) => {
    const isLeaving = card.id in leaving;
    return (
      <div
        key={card.id}
        style={{
          maxHeight: isLeaving ? 0 : 56,
          opacity: isLeaving ? 0 : 1,
          overflow: isLeaving ? 'hidden' : 'visible',
          pointerEvents: isLeaving ? 'none' : undefined,
          transition: `max-height 0.26s ${EASING.smooth}, opacity 0.2s ${EASING.smooth}`,
        }}
        onTransitionEnd={(e) => {
          if (isLeaving && e.propertyName === 'max-height') finishRemove(card.id, quantity);
        }}>
        <DeckCardRow
          card={card}
          quantity={quantity}
          onIncrement={() => onIncrement(card.id)}
          onDecrement={() => onDecrement(card.id)}
          onRemove={() => requestRemove(card.id, quantity)}
          isCore={isCore}
          onSetCore={onSetCore ? () => onSetCore(card.id, !isCore) : undefined}
          onPreviewEnter={(previewCard, anchor) => setPeek({card: previewCard, anchor})}
          onPreviewLeave={() => setPeek(null)}
          onOpenDetails={openDetails}
        />
      </div>
    );
  };

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
        <DeckInfoStrip stats={stats} />
      </div>

      <div style={{padding: `4px ${SPACING.md}px 0`, flexShrink: 0}}>
        <TabList
          tabs={TAB_DEFS}
          active={tab}
          onChange={switchTab}
          ariaLabel="Deck panel views"
        />
      </div>

      {tab === 'cards' && totalCopies(stats.costCurve) > 0 && (
        <div style={{display: 'flex', height: STATS_ROW_HEIGHT, flexShrink: 0, borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              borderRight: `1px solid ${COLORS.surfaceBorder}`,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}>
            <div style={{flex: 1, minHeight: 0}}>
              <CostCurveStrip costCurve={stats.costCurve} costCurveByInk={stats.costCurveByInk} />
            </div>
            <TypeSplitPips typeDistribution={stats.typeDistribution} />
          </div>
          <div style={{flex: 1, minWidth: 0, position: 'relative'}}>
            <HealthSummary
              analysis={analysis ?? null}
              isLoading={analysisLoading ?? false}
              error={analysisError ?? null}
              onOpenAnalysis={() => switchTab('analysis')}
              variant={healthVariant}
            />
            <SortSelect
              options={HEALTH_VARIANT_OPTIONS}
              value={healthVariant}
              onChange={updateHealthVariant}
              ariaLabel="Deck health view"
              style={{position: 'absolute', top: 10, right: 10, zIndex: 2, height: 28, fontSize: FONT_SIZES.md}}
            />
          </div>
        </div>
      )}

      <div style={{flex: 1, minHeight: 0, overflowY: 'auto'}}>
        {tab === 'analysis' ? (
          <AnalysisTab
            analysis={analysis ?? null}
            isLoading={analysisLoading ?? false}
            error={analysisError ?? null}
            gameplan={gameplan}
            onGameplanChange={onGameplanChange ?? (() => {})}
          />
        ) : rows.length === 0 ? (
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
