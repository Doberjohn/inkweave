import { createContext, useState, useCallback, type ReactNode } from "react";
import type { LorcanaCard } from "../types";

interface CardPreviewState {
  card: LorcanaCard | null;
  position: { x: number; y: number };
  isTouchMode: boolean;
}

export interface CardPreviewContextValue {
  previewState: CardPreviewState;
  showPreview: (card: LorcanaCard, x: number, y: number, isTouchMode?: boolean) => void;
  updatePosition: (x: number, y: number) => void;
  hidePreview: () => void;
}

export const CardPreviewContext = createContext<CardPreviewContextValue | null>(null);

export function CardPreviewProvider({ children }: { children: ReactNode }) {
  const [previewState, setPreviewState] = useState<CardPreviewState>({
    card: null,
    position: { x: 0, y: 0 },
    isTouchMode: false,
  });

  const showPreview = useCallback((card: LorcanaCard, x: number, y: number, isTouchMode = false) => {
    setPreviewState({ card, position: { x, y }, isTouchMode });
  }, []);

  const updatePosition = useCallback((x: number, y: number) => {
    setPreviewState((prev) => ({ ...prev, position: { x, y } }));
  }, []);

  const hidePreview = useCallback(() => {
    setPreviewState({ card: null, position: { x: 0, y: 0 }, isTouchMode: false });
  }, []);

  return (
    <CardPreviewContext.Provider value={{ previewState, showPreview, updatePosition, hidePreview }}>
      {children}
    </CardPreviewContext.Provider>
  );
}
