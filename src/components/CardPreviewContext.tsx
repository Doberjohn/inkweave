import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { LorcanaCard } from "../types";

interface CardPreviewState {
  card: LorcanaCard | null;
  position: { x: number; y: number };
}

interface CardPreviewContextValue {
  previewState: CardPreviewState;
  showPreview: (card: LorcanaCard, x: number, y: number) => void;
  updatePosition: (x: number, y: number) => void;
  hidePreview: () => void;
}

const CardPreviewContext = createContext<CardPreviewContextValue | null>(null);

export function CardPreviewProvider({ children }: { children: ReactNode }) {
  const [previewState, setPreviewState] = useState<CardPreviewState>({
    card: null,
    position: { x: 0, y: 0 },
  });

  const showPreview = useCallback((card: LorcanaCard, x: number, y: number) => {
    setPreviewState({ card, position: { x, y } });
  }, []);

  const updatePosition = useCallback((x: number, y: number) => {
    setPreviewState((prev) => ({ ...prev, position: { x, y } }));
  }, []);

  const hidePreview = useCallback(() => {
    setPreviewState({ card: null, position: { x: 0, y: 0 } });
  }, []);

  return (
    <CardPreviewContext.Provider value={{ previewState, showPreview, updatePosition, hidePreview }}>
      {children}
    </CardPreviewContext.Provider>
  );
}

export function useCardPreview() {
  const context = useContext(CardPreviewContext);
  if (!context) {
    throw new Error("useCardPreview must be used within CardPreviewProvider");
  }
  return context;
}
