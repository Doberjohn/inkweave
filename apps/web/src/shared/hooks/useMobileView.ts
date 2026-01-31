import { useState, useCallback } from "react";

export type MobileView = "cards" | "synergies" | "deck";

interface UseMobileViewReturn {
  activeView: MobileView;
  setActiveView: (view: MobileView) => void;
}

export function useMobileView(initialView: MobileView = "cards"): UseMobileViewReturn {
  const [activeView, setActiveViewState] = useState<MobileView>(initialView);

  const setActiveView = useCallback((view: MobileView) => {
    setActiveViewState(view);
  }, []);

  return {
    activeView,
    setActiveView,
  };
}
