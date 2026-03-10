export {
  isDualInk,
  getInks,
  canShareDeck,
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
  getShiftType,
  hasAnyShift,
} from './cardHelpers.js';
export type {LocationRole, ShiftType} from './cardHelpers.js';

export {isCardType} from './typeGuards.js';

export {transformCard, transformCards} from './cardTransformer.js';
export type {LorcanaJSONCard} from './cardTransformer.js';
