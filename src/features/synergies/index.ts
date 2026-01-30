// Types
export type {
  SynergyType,
  SynergyStrength,
  Synergy,
  SynergyRule,
  SynergyMatch,
  SynergyMatchDisplay,
  GroupedSynergies,
} from "./types";

// Engine
export { SynergyEngine, synergyEngine } from "./engine/SynergyEngine";
export type { SynergyEngineOptions } from "./engine/SynergyEngine";
export { getAllRules, getRulesByType, getRuleById, synergyRules } from "./engine/rules";
export { sharedEngine } from "./engine/shared";

// Hooks
export {
  useSynergyFinder,
  useCardData,
  useCardPairSynergy,
} from "./hooks/useSynergyFinder";
export type { UseSynergyFinderReturn, UseCardDataReturn } from "./hooks/useSynergyFinder";

// Components
export { SynergyResults } from "./components/SynergyResults";
export { SynergyGroup } from "./components/SynergyGroup";
export { SynergyCard } from "./components/SynergyCard";
export { CardDetail } from "./components/CardDetail";
