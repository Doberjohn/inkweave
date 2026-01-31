import {useState} from 'react';

export type MobileView = 'cards' | 'synergies' | 'deck';

interface UseMobileViewReturn {
  activeView: MobileView;
  setActiveView: (view: MobileView) => void;
}

export function useMobileView(initialView: MobileView = 'cards'): UseMobileViewReturn {
  const [activeView, setActiveView] = useState<MobileView>(initialView);

  return {
    activeView,
    setActiveView,
  };
}
