import {ToolbarToggle} from '../../shared/components/ToolbarToggle';

/**
 * Collection mode's toolbar control, rendered into `BrowseToolbar`'s
 * `modeSwitch` slot at the toolbar's far end. Only the toggle: on desktop the set
 * picker sits just before it (owner, 2026-10-20, `setPicker`), and elsewhere in the
 * set panel beside the binder.
 *
 * A toggle button rather than a two-tab list: the modes are not peers. "All
 * cards" is the page's resting state and "Collection" is a lens you put on. The
 * toolbar's toggle recipe, shared with Filters (owner, 2026-10-08, replacing
 * "never filled"): filled while the mode is on, the ghost outline while it is off.
 *
 * `onIntent` is told when a press looks likely: a pointer over the button, focus on it, or the
 * press itself starting. The page warms the binder's chunk there (#913), so it is usually in by
 * the time the press lands.
 */
export function CollectionModeSwitch({
  active,
  onToggle,
  onIntent,
}: {
  active: boolean;
  onToggle: () => void;
  onIntent?: () => void;
}) {
  return (
    <ToolbarToggle
      active={active}
      onClick={onToggle}
      onPointerEnter={onIntent}
      onFocus={onIntent}
      onPointerDown={onIntent}
      aria-pressed={active}
      aria-label="Show my collection">
      Collection
    </ToolbarToggle>
  );
}
