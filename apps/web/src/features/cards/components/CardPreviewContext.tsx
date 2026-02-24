import {createContext, useState, useCallback, useMemo, useRef, type ReactNode} from 'react';
import type {LorcanaCard} from '../types';

interface CardPreviewState {
  card: LorcanaCard | null;
  position: {x: number; y: number};
  isTouchMode: boolean;
}

export interface CardPreviewContextValue {
  previewState: CardPreviewState;
  showPreview: (card: LorcanaCard, x: number, y: number, isTouchMode?: boolean) => void;
  updatePosition: (x: number, y: number) => void;
  hidePreview: () => void;
}

export const CardPreviewContext = createContext<CardPreviewContextValue | null>(null);

export function CardPreviewProvider({children}: {children: ReactNode}) {
  const [previewState, setPreviewState] = useState<CardPreviewState>({
    card: null,
    position: {x: 0, y: 0},
    isTouchMode: false,
  });

  const showPreview = useCallback(
    (card: LorcanaCard, x: number, y: number, isTouchMode = false) => {
      setPreviewState({card, position: {x, y}, isTouchMode});
    },
    [],
  );

  // Throttle position updates to one per animation frame
  const rafId = useRef(0);
  const updatePosition = useCallback((x: number, y: number) => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      setPreviewState((prev) => ({...prev, position: {x, y}}));
    });
  }, []);

  const hidePreview = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    setPreviewState({card: null, position: {x: 0, y: 0}, isTouchMode: false});
  }, []);

  const value = useMemo(
    () => ({previewState, showPreview, updatePosition, hidePreview}),
    [previewState, showPreview, updatePosition, hidePreview],
  );

  return <CardPreviewContext.Provider value={value}>{children}</CardPreviewContext.Provider>;
}
