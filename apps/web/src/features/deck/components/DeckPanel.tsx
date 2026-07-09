import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {DeckStats} from '../types';
import {DeckCardRow} from './DeckCardRow';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';

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
}

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

/**
 * The right-hand deck pane: an inline-editable name + count badge, the scrollable
 * list of {@link DeckCardRow}s, and a legality/progress footer. Purely driven by
 * props (resolved rows + {@link DeckStats}); all mutations route back through the
 * page's useDeck actions.
 */
export function DeckPanel({name, onRename, rows, stats, onIncrement, onDecrement, onRemove}: DeckPanelProps) {
  return (
    <aside
      aria-label="Your deck"
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

      <div style={{flex: 1, minHeight: 0, overflowY: 'auto', padding: `${SPACING.sm}px 4px`}}>
        {rows.length === 0 ? (
          <p
            style={{
              padding: SPACING.lg,
              textAlign: 'center',
              color: COLORS.textMuted,
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.base}px`,
            }}>
            No cards yet. Add cards from the pool with the + button.
          </p>
        ) : (
          rows.map(({card, quantity}) => (
            <DeckCardRow
              key={card.id}
              card={card}
              quantity={quantity}
              onIncrement={() => onIncrement(card.id)}
              onDecrement={() => onDecrement(card.id)}
              onRemove={() => onRemove(card.id)}
            />
          ))
        )}
      </div>

      <LegalitySummary stats={stats} />
    </aside>
  );
}
