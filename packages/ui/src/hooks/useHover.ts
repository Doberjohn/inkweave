import {useState} from 'react';
import {isSyntheticMouseEvent} from '../utils/touchGuard';

/**
 * Hover state with the iOS ghost-hover guard built in (#509).
 *
 * Replaces the hand-rolled `useState + onMouseEnter/onMouseLeave` boilerplate
 * (~55 sites at audit time) and closes an invisible mobile inconsistency: most
 * copies skip the touchGuard, so a tap leaves components stuck "hovered" after
 * SPA navigation. Spread `hoverProps` onto the element; pass your own handlers
 * through them if you need side effects:
 *
 *   const {hovered, hoverProps} = useHover();
 *   <button {...hoverProps} style={hovered ? hot : cold} />
 */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    hoverProps: {
      onMouseEnter: () => {
        if (!isSyntheticMouseEvent()) setHovered(true);
      },
      onMouseLeave: () => setHovered(false),
    },
  } as const;
}
