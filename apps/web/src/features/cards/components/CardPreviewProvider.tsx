import {useEffect, useState, useRef, type ReactNode} from 'react';
import type {LorcanaCard} from '../types';
import {CardPreviewContext} from './CardPreviewContext';

export function CardPreviewProvider({children}: {children: ReactNode}) {
  const [previewState, setPreviewState] = useState({
    card: null as LorcanaCard | null,
    position: {x: 0, y: 0},
    isTouchMode: false,
  });

  const showPreview = (card: LorcanaCard, x: number, y: number, isTouchMode = false) => {
    setPreviewState({card, position: {x, y}, isTouchMode});
  };

  // Throttle position updates to one per animation frame
  const rafId = useRef(0);
  const updatePosition = (x: number, y: number) => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      setPreviewState((prev) => ({...prev, position: {x, y}}));
    });
  };

  const hidePreview = () => {
    cancelAnimationFrame(rafId.current);
    setPreviewState({card: null, position: {x: 0, y: 0}, isTouchMode: false});
  };

  // Close preview on browser back/forward navigation
  useEffect(() => {
    const onPopState = () => {
      cancelAnimationFrame(rafId.current);
      setPreviewState({card: null, position: {x: 0, y: 0}, isTouchMode: false});
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <CardPreviewContext.Provider value={{previewState, showPreview, updatePosition, hidePreview}}>
      {children}
    </CardPreviewContext.Provider>
  );
}
