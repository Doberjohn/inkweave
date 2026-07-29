import type {ReactNode} from 'react';
import {ALL_INKS, COLORS, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {InkIcon} from '../../../shared/components/InkIcon';
import {InkwellIcon} from '../../../shared/components/InkwellIcon';
import type {CardType, DeckStats} from '../types';

/** Card types in the order the deck list groups them, with a short column label. */
const TYPE_TILES: ReadonlyArray<{type: CardType; label: string}> = [
  {type: 'Character', label: 'Char'},
  {type: 'Action', label: 'Action'},
  {type: 'Item', label: 'Item'},
  {type: 'Location', label: 'Loc'},
];

/** How wide a tile column gets before the grid wraps to a new row. */
const TILE_MIN_WIDTH = 52;

/** One cell: a symbol (or short word) above its count. */
function StatTile({symbol, count, title}: {symbol: ReactNode; count: number; title: string}) {
  return (
    <div title={title} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.xs}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24}}>{symbol}</div>
      <span
        style={{
          // Dim a zero so an absent type reads as "none" without extra words.
          color: count > 0 ? COLORS.text : COLORS.textDim,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.xl}px`,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
        {count}
      </span>
    </div>
  );
}

/** A row of tiles that wraps rather than squeezing when a deck runs many inks. */
function TileRow({children}: {children: ReactNode}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${TILE_MIN_WIDTH}px, 1fr))`,
        gap: SPACING.sm,
      }}>
      {children}
    </div>
  );
}

/**
 * The deck's makeup as the Deck stats tab: a symbol-and-number grid rather than
 * prose. Top row is the deck's inks plus the inkable/uninkable split — all four
 * carry the game's own glyphs (InkIcon / InkwellIcon), which need no caption for
 * a Lorcana player. Bottom row is the card-type spread, labelled with short words
 * because Lorcana has no established glyph for a card type and inventing one
 * would be guessable at best.
 */
export function DeckProfile({stats}: {stats: DeckStats}) {
  const inks = ALL_INKS.filter((ink) => (stats.inkDistribution[ink] ?? 0) > 0);
  const uninkable = stats.totalCards - stats.inkableCount;

  if (stats.totalCards === 0) {
    return (
      <div style={{padding: SPACING.lg, color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`}}>
        Add cards to see the deck's makeup.
      </div>
    );
  }

  return (
    <div style={{padding: `${SPACING.lg}px ${SPACING.md}px`, display: 'flex', flexDirection: 'column', gap: SPACING.lg}}>
      <TileRow>
        {inks.map((ink) => (
          <StatTile
            key={ink}
            symbol={<InkIcon ink={ink} size={24} />}
            count={stats.inkDistribution[ink] ?? 0}
            title={`${ink} cards`}
          />
        ))}
        <StatTile symbol={<InkwellIcon value="inkable" size={24} />} count={stats.inkableCount} title="Inkable cards" />
        <StatTile symbol={<InkwellIcon value="uninkable" size={24} />} count={uninkable} title="Uninkable cards" />
      </TileRow>

      <div style={{borderTop: `1px solid ${COLORS.surfaceBorder}`, paddingTop: SPACING.lg}}>
        <TileRow>
          {TYPE_TILES.map(({type, label}) => (
            <StatTile
              key={type}
              symbol={
                <span style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`}}>{label}</span>
              }
              count={stats.typeDistribution[type] ?? 0}
              title={`${type} cards`}
            />
          ))}
        </TileRow>
      </div>
    </div>
  );
}
