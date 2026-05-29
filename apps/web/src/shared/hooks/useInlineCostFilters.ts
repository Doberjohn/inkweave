import {INLINE_COST_FILTER_MIN_WIDTH} from '../constants';
import {useResponsive} from './useResponsive';

/**
 * Whether the cost-filter group is shown inline in the toolbar (wide desktop) vs.
 * tucked into the Filters dialog (narrow desktop / mobile). Single source of truth
 * shared by BrowseToolbar (renders inline icons) and FilterContent (adds the cost
 * section to the modal when the icons are hidden), so the two never disagree.
 */
export function useInlineCostFilters(): boolean {
  const {windowWidth} = useResponsive();
  return windowWidth >= INLINE_COST_FILTER_MIN_WIDTH;
}
