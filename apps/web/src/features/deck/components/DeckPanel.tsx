import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {DeckStats} from '../types';
import {DeckCardRow} from './DeckCardRow';
import {previewGeometry} from './previewGeometry';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING} from '../../../shared/constants';

/** Competitive Core deck size — the count badge + progress bar target. */
const DECK_TARGET = 60;

/** A resolved deck line: the card plus how many copies are in the deck. */
export interface DeckRow {
  card: LorcanaCard;
  quantity: number;
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
  /**
   * Clicking a row's thumbnail/name opens that card's detail modal. `siblingIds` is
   * the deck in the panel's VISUAL (type-grouped) order, so the modal's arrow-nav
   * walks the deck as rendered rather than the page's flat cost-then-name sort.
   */
  onOpenDetails?: (card: LorcanaCard, siblingIds: string[]) => void;
}

type PanelTab = 'cards' | 'analysis';

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

// Reserved zones for the advisor (issue #472) — its analyzers already exist under
// features/deck/analysis/; this tab is where they will surface.
const ANALYSIS_ZONES = [
  'Deck quality score',
  'Cost curve',
  'Ink balance',
  'Synergies & key cards',
  'Vulnerabilities · what to watch for',
  'Suggestions',
];

function CountBadge({total, isLegal}: {total: number; isLegal: boolean}) {
  const reached = total >= DECK_TARGET;
  const color = isLegal ? COLORS.success : reached ? COLORS.error : COLORS.textMuted;
  return (
    <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`, fontWeight: 700, color, flexShrink: 0}}>
      {total}/{DECK_TARGET}
    </span>
  );
}

function LegalitySummary({stats}: {stats: DeckStats}) {
  const pct = Math.min(100, Math.round((stats.totalCards / DECK_TARGET) * 100));
  const barColor = stats.isLegal ? COLORS.success : COLORS.primary;
  const status = stats.isLegal
    ? 'Core legal'
    : stats.legalityErrors.length === 0
      ? 'Keep building'
      : `${stats.legalityErrors.length} to fix`;

  return (
    <div style={{padding: SPACING.md, borderTop: `1px solid ${COLORS.surfaceBorder}`, flexShrink: 0}}>
      <div style={{height: 6, borderRadius: RADIUS.sm, background: COLORS.surfaceAlt, overflow: 'hidden'}}>
        <div style={{width: `${pct}%`, height: '100%', background: barColor, transition: 'width 0.2s ease'}} />
      </div>
      <div
        style={{
          marginTop: SPACING.sm,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.md}px`,
          color: stats.isLegal ? COLORS.success : COLORS.textMuted,
        }}>
        {status}
      </div>
      {stats.legalityErrors.map((err) => (
        <div
          key={err}
          style={{marginTop: 4, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.md}px`, color: COLORS.textMuted}}>
          • {err}
        </div>
      ))}
    </div>
  );
}

function AnalysisTab() {
  return (
    <div style={{padding: SPACING.md, display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
      <p style={{fontFamily: FONTS.body, color: COLORS.textMuted, fontSize: `${FONT_SIZES.md}px`, margin: 0}}>
        Reserved for the advisor (#472). The analysis backend already exists; this tab is where it surfaces.
      </p>
      {ANALYSIS_ZONES.map((zone) => (
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
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        pointerEvents: 'none',
        zIndex: 60,
        animation: 'inkweave-row-enter 0.18s ease-out',
      }}>
      <img src={card.imageUrl} alt="" style={{width: '100%', display: 'block'}} />
    </div>,
    document.body,
  );
}

const tabButton = (active: boolean): CSSProperties => ({
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.lg}px`,
  fontWeight: 700,
  color: active ? COLORS.text : COLORS.textMuted,
  padding: '8px 12px',
  borderBottom: `2px solid ${active ? COLORS.primary : 'transparent'}`,
});

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
export function DeckPanel({name, onRename, rows, stats, onIncrement, onDecrement, onRemove, onOpenDetails}: DeckPanelProps) {
  const [tab, setTab] = useState<PanelTab>('cards');
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

  const renderRow = ({card, quantity}: DeckRow) => {
    const isLeaving = card.id in leaving;
    return (
      <div
        key={card.id}
        style={{
          maxHeight: isLeaving ? 0 : 56,
          opacity: isLeaving ? 0 : 1,
          overflow: isLeaving ? 'hidden' : 'visible',
          pointerEvents: isLeaving ? 'none' : undefined,
          transition: 'max-height 0.26s ease, opacity 0.2s ease',
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
        <input
          aria-label="Deck name"
          value={name}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Untitled deck"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: COLORS.text,
            fontFamily: FONTS.hero,
            fontSize: `${FONT_SIZES.xxl}px`,
          }}
        />
        <CountBadge total={stats.totalCards} isLegal={stats.isLegal} />
      </div>

      <div style={{display: 'flex', gap: 4, padding: `4px ${SPACING.md}px 0`, borderBottom: `1px solid ${COLORS.surfaceBorder}`, flexShrink: 0}}>
        <button type="button" onClick={() => switchTab('cards')} style={tabButton(tab === 'cards')}>
          Cards
        </button>
        <button type="button" onClick={() => switchTab('analysis')} style={tabButton(tab === 'analysis')}>
          Analysis
        </button>
      </div>

      <div style={{flex: 1, minHeight: 0, overflowY: 'auto'}}>
        {tab === 'analysis' ? (
          <AnalysisTab />
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

      <LegalitySummary stats={stats} />
      {peek && <FloatingPreview card={peek.card} anchor={peek.anchor} />}
    </aside>
  );
}
