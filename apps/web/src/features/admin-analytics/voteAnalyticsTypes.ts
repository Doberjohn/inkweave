export interface WeeklyPoint {
  week: string;
  votes: number;
  meanGap: number | null;
}

export interface DimensionFill {
  score: number;
  accuracy: number;
  isReal: number;
  wouldPlay: number;
  difficulty: number;
}

export interface GlobalStats {
  totalVotes: number;
  distinctPairs: number;
  distinctVoters: number | null;
  meanGap: number | null;
  accuracySentiment: number | null;
  engineSilentPairs: number;
  weekly: WeeklyPoint[];
  dimensionFill: DimensionFill | null;
}

export interface RuleStat {
  ruleId: string;
  ruleName: string;
  category: 'direct' | 'playstyle';
  scoreVotes: number;
  pairsVoted: number;
  meanGap: number | null;
  accuracySentiment: number | null;
  pairsCovered: number;
}

export interface PairStat {
  a: string;
  b: string;
  aName: string;
  bName: string;
  engineScore: number;
  communityScore: number;
  gap: number;
  scoreVotes: number;
  rules: string[];
}

export interface VoteAnalytics {
  generatedAt: string;
  hasRawVotes: boolean;
  global: GlobalStats;
  rules: RuleStat[];
  pairs: PairStat[];
}
