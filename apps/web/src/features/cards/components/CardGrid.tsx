import {cardPath, type LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {useResponsive} from '../../../shared/hooks';

interface CardGridProps {
  cards: LorcanaCard[];
  onSelect: (card: LorcanaCard) => void;
  /** Number of cards (from index 0) to mark as priority for LCP. Use on first above-fold grid only. */
  priorityCount?: number;
  /** CardTile visual variant. Default 'full'. */
  variant?: 'minimal' | 'full';
  /** Use the small image source (cheaper LCP, lower-res). Default true. */
  useSmallImage?: boolean;
  /** Override card border radius. Defaults to CardTile's own default. */
  borderRadius?: number;
  /** Empty state message. Rendered when cards.length === 0; otherwise empty branch is omitted. */
  emptyMessage?: string;
  /** When true, each tile renders as a crawlable `<a href="/card/:id">` (issue #486). */
  linkToCards?: boolean;
}

/**
 * Standardized non-virtualized card grid used everywhere except BrowsePage.
 *
 * Layout: CSS Grid auto-fill + minmax. Column count emerges from viewport,
 * matching BrowseCardGrid (which uses VirtuosoGrid with the same min values).
 *
 * - Mobile MIN: `LAYOUT.cardGridMinWidthMobile` (96) — 3 cols from a 352px
 *   viewport up, so 360px Android, iPhone 14 (393px), Pixel 7 (412px) and Pro Max
 *   (430px) all get 3; 2 cols only at 320px. Lowered from 140 (which gave 2
 *   everywhere) by owner ruling 2026-08-11.
 * - Desktop MIN: `LAYOUT.cardGridMinWidth` (180) — varies by viewport.
 *
 * Padding is the caller's responsibility — wrap this component in your own
 * styled container. Keeps the grid composable across pages with different
 * padding needs (Reveals tier vs PlaystyleDetail show-all vs synergy panel).
 */
export function CardGrid({
  cards,
  onSelect,
  priorityCount = 0,
  variant = 'full',
  useSmallImage = true,
  borderRadius,
  emptyMessage,
  linkToCards,
}: CardGridProps) {
  const {isMobile} = useResponsive();
  const minColWidth = isMobile ? LAYOUT.cardGridMinWidthMobile : LAYOUT.cardGridMinWidth;

  if (cards.length === 0 && emptyMessage) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 64,
          color: COLORS.textMuted,
          fontSize: `${FONT_SIZES.xl}px`,
        }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))`,
        gap: SPACING.md,
      }}>
      {cards.map((card, i) => (
        <CardTile
          key={card.id}
          card={card}
          href={linkToCards ? cardPath(card) : undefined}
          isSelected={false}
          onSelect={onSelect}
          variant={variant}
          useSmallImage={useSmallImage}
          priority={i < priorityCount}
          borderRadius={borderRadius}
        />
      ))}
    </div>
  );
}
