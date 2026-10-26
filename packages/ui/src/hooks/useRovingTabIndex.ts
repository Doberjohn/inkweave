import {useEffect, useRef, useState, type RefObject} from 'react';

interface UseRovingTabIndexOptions {
  /** Total number of items in the grid */
  itemCount: number;
  /** Number of columns (for up/down navigation) */
  columns: number;
  /** Optional external container ref (hook creates its own if not provided) */
  containerRef?: RefObject<HTMLElement | null>;
}

/**
 * Roving tabindex for grid-like keyboard navigation.
 *
 * Only the active item gets tabIndex={0}; all others get tabIndex={-1}.
 * Arrow keys move focus within the grid; Tab exits the group entirely.
 */
export function useRovingTabIndex({
  itemCount,
  columns,
  containerRef: externalRef,
}: UseRovingTabIndexOptions) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const internalRef = useRef<HTMLElement>(null);
  const containerRef = externalRef ?? internalRef;
  const safeCols = Math.max(1, columns);

  // Clamp activeIndex when itemCount shrinks (e.g., after filtering)
  useEffect(() => {
    setActiveIndex((prev) => {
      const clamped = itemCount === 0 ? 0 : Math.min(prev, itemCount - 1);
      activeIndexRef.current = clamped;
      return clamped;
    });
  }, [itemCount]);

  const focusItem = (index: number) => {
    if (index < 0 || index >= itemCount) return;
    activeIndexRef.current = index;
    setActiveIndex(index);
    // Focus the element after state update and DOM reconciliation
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const items = container.querySelectorAll<HTMLElement>('[data-roving-item]');
      items[index]?.focus();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        nextIndex = current + safeCols;
        break;
      case 'ArrowUp':
        nextIndex = current - safeCols;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = itemCount - 1;
        break;
      default:
        return; // Don't prevent default for other keys (Tab, etc.)
    }

    if (nextIndex >= 0 && nextIndex < itemCount) {
      e.preventDefault();
      focusItem(nextIndex);
    }
  };

  const getTabIndex = (index: number) => (index === activeIndex ? 0 : -1);

  return {activeIndex, containerRef, handleKeyDown, getTabIndex, focusItem};
}
