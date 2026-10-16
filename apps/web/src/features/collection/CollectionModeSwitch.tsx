import {ToolbarToggle} from '../../shared/components/ToolbarToggle';

/**
 * Collection mode's toolbar control, rendered into `BrowseToolbar`'s
 * `modeSwitch` slot at the toolbar's far end. Only the toggle: choosing the set
 * lives in the set panel's header beside the binder (owner ruling 2026-08-14).
 *
 * A toggle button rather than a two-tab list: the modes are not peers. "All
 * cards" is the page's resting state and "Collection" is a lens you put on. The
 * toolbar's toggle recipe, shared with Filters (owner, 2026-10-08, replacing
 * "never filled"): filled while the mode is on, the ghost outline while it is off.
 */
export function CollectionModeSwitch({active, onToggle}: {active: boolean; onToggle: () => void}) {
  return (
    <ToolbarToggle active={active} onClick={onToggle} aria-pressed={active} aria-label="Show my collection">
      Collection
    </ToolbarToggle>
  );
}
