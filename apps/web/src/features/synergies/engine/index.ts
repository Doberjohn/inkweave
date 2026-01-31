// Re-export from the synergy-engine package
export {
  SynergyEngine,
  synergyEngine,
  SynergyCache,
  synergyCache,
  synergyRules,
  getAllRules,
  getRulesByType,
  getRuleById,
} from 'lorcana-synergy-engine';
export type {SynergyEngineOptions, CachedSynergyResult} from 'lorcana-synergy-engine';

// Re-export sharedEngine as an alias to synergyEngine for backwards compatibility
export {synergyEngine as sharedEngine} from 'lorcana-synergy-engine';
