import {useRef, type CSSProperties, type ReactNode} from 'react';
import {FilterContent} from '../../../shared/components/FilterContent';
import {LinkButton} from 'inkweave-ui/components/LinkButton';
import {COLORS, RADIUS, SPACING} from '../../../shared/constants';
import {useResponsive} from 'inkweave-ui/hooks/useResponsive';

/**
 * Browse's docked side panels (desktop): the filters on the left, live, in place of
 * the Filters dialog (owner, 2026-10-07), and in collection mode the set panel on the
 * right, under the Collection button (owner, 2026-10-08; it was a tab beside the
 * filters before). One surface and width for both, so the page reads as a binder
 * framed by its two panels, and switching mode changes nothing on the left.
 *
 *   - FILTERS APPLY AS YOU CLICK. The dialog stages a draft behind Apply because
 *     it covers the grid; docked, the grid is the preview.
 *   - EVERY FILTER LIVES HERE, the toolbar's inline ink, cost and inkwell icons
 *     included: one place to look, not two.
 *   - OPEN BY DEFAULT; the toolbar's Filters button closes and reopens it. The set
 *     panel shows whenever collection mode is on.
 *
 * Below `BREAKPOINTS.desktop` there is no room for them, and the dialog stays.
 */

/** Width of the docked panel. The set panel's layouts use it too. */
export const SIDE_PANEL_WIDTH = 260;

/**
 * Browse's desktop gutter: the toolbar's side padding, the panel's offset from the page edge,
 * and the card grid's own padding. One number, so the docked toolbar lines up with what sits
 * under it: Filters and the sort over the panel, the search where the cards start.
 */
export const BROWSE_GUTTER = 32;

/**
 * The room between Browse's toolbar, which ends at its controls, and the row under it: the
 * panels' and the binder's top padding, and the card grid's, inside its scroller, where a
 * pointed-at card's glow needs it (`.card-tile` in index.css: 22px of blur past a 3px spread).
 * The toolbar held this room until the glow came, and the scroller cut the glow's top off.
 */
export const BROWSE_ROW_TOP = SPACING.xxl;

/** The panel surface, shared with the collection set panel's other layouts. */
export const SIDE_PANEL_STYLE: CSSProperties = {
  width: SIDE_PANEL_WIDTH,
  flexShrink: 0,
  background: COLORS.surface,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: `${RADIUS.card}px`,
  padding: SPACING.md,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.md,
  overflowY: 'auto',
};

/**
 * Whether Browse docks the panel at this width. One definition, because the page
 * (which renders the panel) and the binder section (which then drops its own set
 * panel) must never disagree, or a width would show both or neither.
 */
export function useSidePanelDocked(): boolean {
  return useResponsive().isDesktop;
}

/** What `FilterContent` needs, wired straight to the URL state. The panel adds its own Clear all. */
export type PanelFilterProps = Omit<
  React.ComponentProps<typeof FilterContent>,
  'variant' | 'showInlineCost' | 'headerAction'
>;

interface BrowseSidePanelProps {
  filterProps: PanelFilterProps;
  activeFilterCount: number;
  onClearFilters: () => void;
}

function FiltersBody({filterProps, activeFilterCount, onClearFilters}: BrowseSidePanelProps) {
  return (
    // One child for the panel's flex column, whose gap would otherwise space the
    // sections on top of their own margins.
    <div>
      <FilterContent
        {...filterProps}
        variant="panel"
        // On the first section's header line (Ink), not a row of its own, so appearing
        // never shifts the sections and no empty strip sits above them while nothing is
        // active. An item of that line, not an overlay: the Ink toggle and its hover wash
        // stop short of it (owner, 2026-10-12).
        headerAction={activeFilterCount > 0 ? <LinkButton onClick={onClearFilters}>Clear all</LinkButton> : undefined}
      />
    </div>
  );
}

/** The filters panel, on the page's left. */
export function BrowseSidePanel({onClearFilters, ...props}: BrowseSidePanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  // Clear all goes as soon as nothing is active, taking focus with it: hand focus to the
  // panel, or it falls to the page and the next Tab starts from the top.
  const clearAll = () => {
    onClearFilters();
    panelRef.current?.focus();
  };
  return (
    <aside ref={panelRef} tabIndex={-1} aria-label="Filters" style={{...SIDE_PANEL_STYLE, height: '100%'}}>
      <FiltersBody {...props} onClearFilters={clearAll} />
    </aside>
  );
}

/** Collection mode's set panel, on the page's right: the filters panel's surface and width. */
export function DockedSetPanel({children}: {children: ReactNode}) {
  return (
    <aside aria-label="Set" style={{...SIDE_PANEL_STYLE, height: '100%'}}>
      {children}
    </aside>
  );
}

/**
 * The page's row under the toolbar: the grid or binder, framed by the docked panels. Each
 * panel sits one gutter from the page's edge and `BROWSE_ROW_TOP` under the toolbar, and is
 * bottom-padded like the binder section, so the boxes start and end level; the grid or binder
 * brings its own inner padding.
 */
export function DockedPanelsRow({left, right, children}: {left?: ReactNode; right?: ReactNode; children: ReactNode}) {
  return (
    <div style={{flex: 1, minHeight: 0, display: 'flex'}}>
      {left && (
        <div style={{padding: `${BROWSE_ROW_TOP}px 0 ${SPACING.xxl}px ${BROWSE_GUTTER}px`, flexShrink: 0}}>{left}</div>
      )}
      <div style={{flex: 1, minWidth: 0, minHeight: 0, position: 'relative'}}>{children}</div>
      {right && (
        <div style={{padding: `${BROWSE_ROW_TOP}px ${BROWSE_GUTTER}px ${SPACING.xxl}px 0`, flexShrink: 0}}>{right}</div>
      )}
    </div>
  );
}
