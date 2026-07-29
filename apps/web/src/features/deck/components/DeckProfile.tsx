import type {ReactNode} from 'react';
import {ALL_INKS, COLORS, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {InkIcon} from '../../../shared/components/InkIcon';
import {InkwellIcon} from '../../../shared/components/InkwellIcon';
import type {CardType, DeckStats} from '../types';

/** Symbol size for every tile, ink glyphs included. */
const SYMBOL_SIZE = 32;

/** How narrow a tile column may get before the row wraps. */
const TILE_MIN_WIDTH = 56;

/**
 * Card-type glyphs. Lorcana prints no type symbol on its cards, so these are the
 * conventional TCG readings rather than game iconography: a figure for Character,
 * a bolt for the one-shot Action, a gem for an Item, a pin for a Location. Each
 * tile keeps a `title` so the meaning is always one hover away.
 */
function CharacterIcon() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ActionIcon() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M13 3 5 13.5h5.5L11 21l8-10.5h-5.5L13 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ItemIcon() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 21 9.5 17.5 20h-11L3 9.5 12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M3 9.5h18M12 3v17" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width={SYMBOL_SIZE} height={SYMBOL_SIZE} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Card types in the order the deck list groups them. */
const TYPE_TILES: ReadonlyArray<{type: CardType; icon: ReactNode}> = [
  {type: 'Character', icon: <CharacterIcon />},
  {type: 'Action', icon: <ActionIcon />},
  {type: 'Item', icon: <ItemIcon />},
  {type: 'Location', icon: <LocationIcon />},
];

/** One cell: a symbol above its count. */
function StatTile({symbol, count, title}: {symbol: ReactNode; count: number; title: string}) {
  const present = count > 0;
  return (
    <div title={title} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.xs}}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: SYMBOL_SIZE,
          // Dim the whole tile when the deck has none, so absence reads at a glance.
          color: present ? COLORS.textMuted : COLORS.textDim,
          opacity: present ? 1 : 0.45,
        }}>
        {symbol}
      </div>
      <span
        style={{
          color: present ? COLORS.text : COLORS.textDim,
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
 * prose. Top row is the deck's inks plus the inkable/uninkable split, all carrying
 * the game's own glyphs; bottom row is the card-type spread. The rows fill the
 * tab's full height and distribute evenly, so the grid never bunches at the top.
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
    <div
      style={{
        height: '100%',
        boxSizing: 'border-box',
        padding: `${SPACING.md}px ${SPACING.md}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        gap: SPACING.sm,
      }}>
      <TileRow>
        {inks.map((ink) => (
          <StatTile
            key={ink}
            symbol={<InkIcon ink={ink} size={SYMBOL_SIZE} />}
            count={stats.inkDistribution[ink] ?? 0}
            title={`${ink} cards`}
          />
        ))}
        <StatTile symbol={<InkwellIcon value="inkable" size={SYMBOL_SIZE} />} count={stats.inkableCount} title="Inkable cards" />
        <StatTile symbol={<InkwellIcon value="uninkable" size={SYMBOL_SIZE} />} count={uninkable} title="Uninkable cards" />
      </TileRow>

      <TileRow>
        {TYPE_TILES.map(({type, icon}) => (
          <StatTile key={type} symbol={icon} count={stats.typeDistribution[type] ?? 0} title={`${type} cards`} />
        ))}
      </TileRow>
    </div>
  );
}
