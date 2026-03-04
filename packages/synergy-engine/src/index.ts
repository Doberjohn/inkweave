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
  PairSynergyConnection,
  DetailedPairSynergy,
} from './types';

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
} from './engine';
export type {SynergyEngineOptions, CachedSynergyResult} from './engine';

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
} from './utils';
export type {LocationRole} from './utils';
