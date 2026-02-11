import {useState, useEffect, useRef, useMemo} from 'react';
import {BREAKPOINTS} from '../constants';

interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
  windowWidth: number;
}

// Touch detection is constant for a session - compute once
const detectTouchDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

const getWidthState = (width: number) => ({
  isMobile: width < BREAKPOINTS.tablet,
  isTablet: width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop,
  isDesktop: width >= BREAKPOINTS.desktop,
  windowWidth: width,
});

const RESIZE_DEBOUNCE_MS = 150;

export function useResponsive(): ResponsiveState {
  // Touch capability is constant - compute once on mount
  const isTouchDevice = useMemo(() => detectTouchDevice(), []);

  const [widthState, setWidthState] = useState(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.desktop;
    return getWidthState(width);
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // SSR check
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setWidthState(getWidthState(window.innerWidth));
      }, RESIZE_DEBOUNCE_MS);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    ...widthState,
    isTouchDevice,
  };
}
