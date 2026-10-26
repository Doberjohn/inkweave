import type {CSSProperties, ReactNode} from 'react';
import {FiltersButton} from 'inkweave-ui/components/FiltersButton';
import {BROWSE_PHONE_TOOLBAR_BOTTOM} from '../cards/components/BrowseSidePanel';
import {SPACING} from '../../shared/constants';

interface PhoneBinderRowProps {
  /** The set button (`PhoneSetPicker`), or its placeholder while the binder's chunk loads. */
  setPicker: ReactNode;
  /** Filters' badge: the filters on, plus one while the binder shows only Owned or Missing. */
  count: number;
  /** Filters' press: opens the Binder sheet. */
  onOpen: () => void;
  /** Collection, which leaves the binder for the grid, at the row's far end as in grid mode. */
  modeSwitch: ReactNode;
}

/** Browse's row on a phone (`getToolbarStyle` in BrowseToolbar.tsx): 12px over its controls, 8px under them, 16px in. */
const ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.sm,
  padding: `${SPACING.md}px ${SPACING.lg}px ${BROWSE_PHONE_TOOLBAR_BOTTOM}px`,
  // Above the binder, as the toolbar is, so the set list opens over the page.
  position: 'relative',
  zIndex: 1,
  flexShrink: 0,
};

/** The set button takes what Filters and Collection leave, as a docked toolbar's sort does. */
const SET_SLOT: CSSProperties = {flex: 1, minWidth: 0};

/**
 * A phone's one row over the binder in collection mode (owner, 2026-10-25, #969), in place of
 * Browse's title, its toolbar and the set strip, which took the top 277px of an iPhone 15 and
 * left the page's last row cut short. The binder under it is the page's protagonist.
 *
 * IT IS GRID MODE'S ROW (owner, 2026-10-26, #1000): Filters first, the set button where the sort
 * sits, then Collection, each 34px tall, with Browse's room above and below, so switching modes
 * moves nothing in it. Filters opens the Binder sheet, which holds what the binder shows, its
 * sort, the filters and the numbers, its badge counting the filters on and Owned or Missing, and
 * its name saying the count (`FiltersButton`), so no chips sit under the row. The set button
 * shows the scope and its two percentages and opens the set list.
 */
export function PhoneBinderRow({setPicker, count, onOpen, modeSwitch}: PhoneBinderRowProps) {
  return (
    <div data-testid="phone-binder-row" style={ROW_STYLE}>
      <FiltersButton onClick={onOpen} activeCount={count} isMobile />
      <div style={SET_SLOT}>{setPicker}</div>
      {modeSwitch}
    </div>
  );
}
