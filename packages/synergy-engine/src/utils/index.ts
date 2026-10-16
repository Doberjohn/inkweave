export {
  isDualInk,
  getInks,
  canShareDeck,
  normalizeCardText,
  textContains,
  hasKeyword,
  hasKeywordExact,
  hasClassification,
  getBaseName,
  getShiftAliasNames,
  getShiftBaseNames,
  getKeywordValue,
  isSong,
  isCharacter,
  isAction,
  isItem,
  isLocation,
  hasNegativeTargeting,
  hasPositiveClassificationEffect,
  getShiftType,
  hasAnyShift,
  isDuoShift,
  getInkDropGain,
} from './cardHelpers.js';
export type {ShiftType, ShiftPayment} from './cardHelpers.js';

export {
  isLocationSupportCard,
  getLocationRoles,
  getLocationBuffClassifications,
  getLocationMoveClassifications,
  locationRoleReaches,
  isMoveOnlyLocationRamp,
  getSelfOnlyLocationRoles,
  stripDamageMoves,
  LOCATION_PATTERNS,
  isBoostBeneficiaryLocation,
} from './detection/locationControl.js';
export type {LocationRole} from './detection/locationControl.js';

export {getNamedReferences, classifyNamedEffect, NAMED_EFFECT_SCORES} from './detection/namedCompanions.js';
export type {NamedEffectTier} from './detection/namedCompanions.js';

export {getDiscardRoles, isDiscardCard} from './detection/discard.js';
export type {DiscardRole} from './detection/discard.js';

export {
  getSacrificeRoles,
  isSacrificeCard,
  triggersOnAnyBanish,
  banishTriggerFiresOnYourTurn,
  banishPayoffPaysLittle,
} from './detection/sacrifice.js';
export type {SacrificeRole} from './detection/sacrifice.js';

export {
  getSelfDiscardRoles,
  isSelfDiscardCard,
  selfDiscardOutletFeed,
  selfDiscardOutletFeedsPile,
  selfDiscardMillFeedsRecursion,
  selfDiscardHandTrimFeed,
} from './detection/selfDiscard.js';
export type {SelfDiscardRole, SelfDiscardFeed} from './detection/selfDiscard.js';

export {
  getRampRoles,
  isRampCard,
  isDeckRamp,
  isRepeatingTrigger,
  inkLandsOffTriggerTurn,
  getCostReductionTarget,
  costReductionTargetsOverlap,
} from './detection/ramp.js';
export type {RampRole, CostReductionTarget} from './detection/ramp.js';

export {getToyRoles, isToyCard, toyAbilityCounts, TOY_TRIBAL_ROLES} from './detection/toy.js';
export type {ToyRole} from './detection/toy.js';

export {getDwarfsRoles, isDwarfsCard} from './detection/dwarfs.js';
export type {DwarfsRole} from './detection/dwarfs.js';

export {getFloodbornRoles, isFloodbornCard, floodbornBuffAlreadyPrinted} from './detection/floodborn.js';
export type {FloodbornRole} from './detection/floodborn.js';

export {getHunnyRoles, isHunnyCard, isHunnyTeamBuff, countsAsHunnyCharacter} from './detection/hunny.js';
export type {HunnyRole} from './detection/hunny.js';

export {getRedPandaRoles, isRedPandaCard} from './detection/redPanda.js';
export type {RedPandaRole} from './detection/redPanda.js';

export {getItemRoles, isItemCard, readiesItemsOnly, hasExertAbility} from './detection/items.js';
export type {ItemRole} from './detection/items.js';

export {
  getHealRoles,
  isHealCard,
  healsOnlyAsTemporaryShiftEnds,
  healPayoffTriggers,
} from './detection/healing.js';
export type {HealRole} from './detection/healing.js';

export {
  getExertRoles,
  isExertCard,
  isExertConsumePayoff,
  exertEnablerReachesPayoff,
} from './detection/exert.js';
export type {ExertRole} from './detection/exert.js';

export {
  getBounceRoles,
  getBounceTargetGate,
  bounceGateAdmits,
  isBounceCard,
} from './detection/bounce.js';
export type {BounceRole, BounceTargetGate} from './detection/bounce.js';

export {strengthInChallenge, cantChallenge} from './detection/spikeSuit.js';

export {getTribalRoles, tribalPayoffClasses, isTribalCard, TRIBAL_SPECS} from './detection/tribes.js';
export type {TribalRole, TribalSpec} from './detection/tribes.js';

export {
  isSteadyAimAnchor,
  getActionDamage,
  isMeridaDamageAction,
  isMultiTargetDamageAction,
} from './detection/meridaArcher.js';

export {isBeckonAnchor, getBeckonEnablerTier, isBeckonEnabler} from './detection/meridaWisp.js';
export type {BeckonEnablerTier} from './detection/meridaWisp.js';

export {getLoreDenialRoles, isLoreDenialCard, LORE_LOSS_PATTERN} from './detection/loreLoss.js';
export type {LoreDenialRole} from './detection/loreLoss.js';

export {
  getInkDropRoles,
  isInkDropCard,
  isDropSpendRider,
  isDropRemoveTrigger,
  isDropHoldPayoff,
  isDropSink,
  isDropGainGate,
  isRepeatingDropMaker,
  isLateDropMaker,
  isOpponentGatedDrop,
} from './detection/inkDrops.js';
export type {InkDropRole} from './detection/inkDrops.js';

export {isCardType} from './typeGuards.js';

export {
  MECHANICS,
  STRUCTURAL_MECHANICS,
  MECHANIC_BY_ID,
  STRUCTURAL_ROLE_TO_MECHANIC,
  getCardMechanics,
  mechanicLabel,
  mechanicDescription,
  tribalMechanicDescription,
} from './mechanics.js';
export type {Mechanic} from './mechanics.js';

export {transformCard, transformCards} from './cardTransformer.js';
export type {LorcanaJSONCard, RawCardVariant} from './cardTransformer.js';

export {cardSlug, cardPath} from './cardSlug.js';

export {
  canonicalizeCardLine,
  canonicalizeCardText,
  canonicalizeCardFullText,
  findGlyphWords,
  findSpelledGlyphWords,
  NAMED_REFERENCE,
} from './cardTextStyle.js';
