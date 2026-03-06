// Re-export from the synergy-engine package
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
} from 'inkweave-synergy-engine';
export type {SynergyEngineOptions, CachedSynergyResult} from 'inkweave-synergy-engine';

// Re-export sharedEngine as an alias to synergyEngine for backwards compatibility
export {synergyEngine as sharedEngine} from 'inkweave-synergy-engine';
