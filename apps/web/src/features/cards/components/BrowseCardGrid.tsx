import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from './CardTile';
import {COLORS, FONT_SIZES, LAYOUT, SPACING} from '../../../shared/constants';
import {LoadingSpinner} from '../../../shared/components';
import {useContainerWidth} from '../../../shared/hooks/useContainerWidth';

interface BrowseCardGridProps {
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: LorcanaCard) => void;
}

const GAP = SPACING.md;
const MIN_COL_WIDTH = LAYOUT.browseCardMinWidth;
// Card aspect ratio: width / height = 0.72, so height = width / 0.72
const CARD_ASPECT = 0.72;

export function BrowseCardGrid({cards, isLoading, onCardSelect}: BrowseCardGridProps) {
  const displayedCards = useMemo(() => cards.slice(0, LAYOUT.maxDisplayedCards), [cards]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(scrollRef);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);

  // Clamp activeIndex when displayed cards change (e.g., after filtering)
  useEffect(() => {
    setActiveIndex((prev) => {
      const clamped = displayedCards.length === 0 ? 0 : Math.min(prev, displayedCards.length - 1);
      activeIndexRef.current = clamped;
      return clamped;
    });
  }, [displayedCards.length]);

  // Compute columns and row height from container width
  const columns = Math.max(1, Math.floor((containerWidth + GAP) / (MIN_COL_WIDTH + GAP)));
  const colWidth = (containerWidth - GAP * (columns - 1)) / columns;
  const rowHeight = colWidth / CARD_ASPECT + GAP;

  // Chunk cards into rows
  const rows = useMemo(() => {
    const result: LorcanaCard[][] = [];
    for (let i = 0; i < displayedCards.length; i += columns) {
      result.push(displayedCards.slice(i, i + columns));
    }
    return result;
  }, [displayedCards, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });

  const focusCard = useCallback(
    (index: number) => {
      if (index < 0 || index >= displayedCards.length) return;
      activeIndexRef.current = index;
      setActiveIndex(index);
      const targetRow = Math.floor(index / columns);
      virtualizer.scrollToIndex(targetRow, {align: 'auto'});

      // Retry focus until the virtualized target row is rendered (max 3 frames)
      let attempts = 0;
      const tryFocus = () => {
        const colInRow = index % columns;
        const renderedRows = scrollRef.current?.querySelectorAll<HTMLElement>('[data-row-index]');
        let focused = false;
        renderedRows?.forEach((row) => {
          if (Number(row.dataset.rowIndex) === targetRow) {
            const buttons = row.querySelectorAll<HTMLElement>('[data-roving-item]');
            const target = buttons[colInRow];
            if (target) {
              target.focus();
              focused = true;
            }
          }
        });
        if (!focused && attempts < 3) {
          attempts++;
          requestAnimationFrame(tryFocus);
        }
      };
      requestAnimationFrame(tryFocus);
    },
    [displayedCards.length, columns, virtualizer],
  );

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const current = activeIndexRef.current;
      let nextIndex: number;
      switch (e.key) {
        case 'ArrowRight':
          nextIndex = current + 1;
          break;
        case 'ArrowLeft':
          nextIndex = current - 1;
          break;
        case 'ArrowDown':
          nextIndex = current + columns;
          break;
        case 'ArrowUp':
          nextIndex = current - columns;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = displayedCards.length - 1;
          break;
        default:
          return;
      }
      if (nextIndex >= 0 && nextIndex < displayedCards.length) {
        e.preventDefault();
        focusCard(nextIndex);
      }
    },
    [columns, displayedCards.length, focusCard],
  );

  if (isLoading) {
    return (
      <div style={{display: 'flex', justifyContent: 'center', padding: 64}}>
        <LoadingSpinner />
      </div>
    );
  }

  // Wait for container measurement before rendering virtual rows
  if (containerWidth === 0) {
    return (
      <div ref={scrollRef} style={{flex: 1, minHeight: 0, padding: `${SPACING.lg}px 32px 32px`}} />
    );
  }

  if (displayedCards.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 64,
          color: COLORS.textMuted,
          fontSize: `${FONT_SIZES.xl}px`,
        }}>
        No cards match your filters.
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      style={{
        padding: `${SPACING.lg}px 32px 32px`,
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
      }}>
      <div
        role="grid"
        aria-label="Card grid"
        onKeyDown={handleGridKeyDown}
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            role="row"
            data-row-index={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: GAP,
              alignItems: 'start',
            }}>
            {rows[virtualRow.index].map((card, colIndex) => (
              <div key={card.id} role="gridcell">
                <CardTile
                  card={card}
                  isSelected={false}
                  onSelect={onCardSelect}
                  variant="minimal"
                  priority={virtualRow.index === 0}
                  useSmallImage
                  tabIndex={virtualRow.index * columns + colIndex === activeIndex ? 0 : -1}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
