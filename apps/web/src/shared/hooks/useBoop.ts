import {useState, useCallback, useEffect} from 'react';
import {EASING} from '../constants';

interface BoopConfig {
  /** X translation in px. Default 0. */
  x?: number;
  /** Y translation in px. Default 0. */
  y?: number;
  /** Rotation in degrees. Default 0. */
  rotation?: number;
  /** Scale factor. Default 1. */
  scale?: number;
  /** Duration in ms before the boop resets. Default 200. */
  timing?: number;
}

interface BoopReturn {
  style: React.CSSProperties;
  trigger: () => void;
  /** Convenience handlers for hover-triggered boops */
  handlers: {
    onMouseEnter: () => void;
  };
}

/**
 * A hook that applies a brief transform burst (the "boop") and auto-resets.
 * Inspired by Josh Comeau's useBoop — implemented with CSS transitions, no deps.
 *
 * Usage:
 *   const {style, handlers} = useBoop({scale: 1.1, rotation: 3});
 *   <button style={style} {...handlers}>Click me</button>
 */
export function useBoop({
  x = 0,
  y = 0,
  rotation = 0,
  scale = 1,
  timing = 200,
}: BoopConfig = {}): BoopReturn {
  const [isBooped, setIsBooped] = useState(false);

  const trigger = useCallback(() => {
    setIsBooped(true);
  }, []);

  useEffect(() => {
    if (!isBooped) return;
    const timer = setTimeout(() => setIsBooped(false), timing);
    return () => clearTimeout(timer);
  }, [isBooped, timing]);

  const style: React.CSSProperties = {
    transform: isBooped
      ? `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`
      : 'translate(0px, 0px) rotate(0deg) scale(1)',
    transition: `transform ${timing}ms ${EASING.bounce}`,
  };

  return {
    style,
    trigger,
    handlers: {
      onMouseEnter: trigger,
    },
  };
}
