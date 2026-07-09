import {forwardRef, type CSSProperties, type ReactNode} from 'react';
import {VirtuosoGrid} from 'react-virtuoso';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {PoolCardTile} from './PoolCardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {useResponsive} from '../../../shared/hooks';

interface DeckPoolGridProps {
  cards: LorcanaCard[];
  /** The deck's inks — forwarded to each tile for off-ink gating. */
  deckInks: Ink[];
  /** cardId → copies already in the deck (drives each tile's count + stepper). */
  quantities: Map<string, number>;
  onIncrement: (card: LorcanaCard) => void;
  onDecrement: (card: LorcanaCard) => void;
  onViewDetails: (card: LorcanaCard) => void;
}

interface ListContainerProps {
  style?: CSSProperties;
  children?: ReactNode;
}

// See BrowseCardGrid: VirtuosoGrid imperatively writes paddingTop/paddingBottom
// for virtual scroll positioning, so only horizontal padding is safe to set here.
// Row gap is a touch wider than the column gap to give the tiles' overhanging
// stepper (and its glow) breathing room between rows.
const createListContainer = (paddingX: number, minColWidth: number) =>
  forwardRef<HTMLDivElement, ListContainerProps>(function ListContainer({style, children}, ref) {
    return (
      <div
        ref={ref}
        style={{
          ...style,
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))`,
          columnGap: SPACING.md,
          rowGap: SPACING.lg,
          paddingLeft: paddingX,
          paddingRight: paddingX,
        }}>
        {children}
      </div>
    );
  });

/**
 * Virtualized grid of {@link PoolCardTile}. Unlike BrowseCardGrid it renders the
 * FULL pool (no 204-card cap) since a deck-builder must show the whole legal
 * card base; react-virtuoso keeps it cheap by only mounting visible rows.
 * Requires a height-bounded flex ancestor (the page provides `flex:1;minHeight:0`).
 */
export function DeckPoolGrid({cards, deckInks, quantities, onIncrement, onDecrement, onViewDetails}: DeckPoolGridProps) {
  const {isMobile} = useResponsive();
  const paddingX = isMobile ? SPACING.lg : SPACING.md;
  const minColWidth = isMobile ? LAYOUT.cardGridMinWidthMobile : LAYOUT.cardGridMinWidth;
  const ListContainer = createListContainer(paddingX, minColWidth);

  if (cards.length === 0) {
    return (
      <div style={{textAlign: 'center', padding: 48, color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`}}>
        No cards match your filters.
      </div>
    );
  }

  return (
    <VirtuosoGrid
      totalCount={cards.length}
      components={{List: ListContainer}}
      itemContent={(index) => {
        const card = cards[index];
        return (
          <PoolCardTile
            card={card}
            deckInks={deckInks}
            inDeckCount={quantities.get(card.id) ?? 0}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            onViewDetails={onViewDetails}
            priority={index < 6}
          />
        );
      }}
      style={{height: '100%'}}
    />
  );
}
