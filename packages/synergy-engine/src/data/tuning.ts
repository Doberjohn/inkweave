import raw from './tuning.json';

export interface TierText {
  score?: number; // Absent for computed-score tiers (Shift's activation bonus)
  text?: string;
}

export interface TuningConfig {
  playstyles: Record<string, {name: string; tagline: string}>;
  directRules: Record<string, {name: string; description: string}>;
  ruleTexts: {
    'shift-targets': Record<string, TierText>;
    ramp: {scores: Record<string, number>; templates: Record<string, string>};
  };
}

export const TUNING = raw as TuningConfig;
