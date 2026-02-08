import {useState} from 'react';

export type MobileView = 'cards' | 'synergies';

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
