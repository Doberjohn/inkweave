// Types
export type {
  Ink,
  GameMode,
  CardType,
  LorcanaCard,
  SynergyCategory,
  PlaystyleId,
  Playstyle,
  DirectSynergyRule,
  PlaystyleSynergyRule,
  SynergyRule,
  SynergyMatch,
  SynergyMatchDisplay,
  SynergyGroup,
} from './types/index.js';

// Engine
export {
  SynergyEngine,
  synergyEngine,
  SynergyCache,
  synergyCache,
  synergyRules,
  getAllRules,
  getRulesByCategory,
  getRulesByPlaystyle,
  getRuleById,
  getAllPlaystyles,
  getPlaystyleById,
} from './engine/index.js';
export type {SynergyEngineOptions, CachedSynergyResult} from './engine/index.js';

// Utilities (for custom rule authors)
export {
  textContains,
  hasKeyword,
  hasKeywordExact,
  hasClassification,
  getBaseName,
  getKeywordValue,
  isSong,
  isCharacter,
  isAction,
  isItem,
  isLocation,
  hasNegativeTargeting,
  hasPositiveClassificationEffect,
  isLocationSupportCard,
  getLocationRoles,
  LOCATION_PATTERNS,
  isCardType,
} from './utils/index.js';
export type {LocationRole} from './utils/cardHelpers.js';
