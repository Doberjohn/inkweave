import type {LorcanaCard, PairSynergyConnection} from 'inkweave-synergy-engine';
import type {Accuracy, Score} from '../../shared/lib/supabase';

/** Raw entry from _pairs_index.json: [cardA_id, cardB_id, aggregateScore] */
export type PairIndexEntry = [string, string, number];

/** Resolved pair ready for display */
export interface VotingPair {
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  aggregateScore: number;
  connections: PairSynergyConnection[];
}

/** Vote form state (random vote: score + whoCarries only) */
export interface VoteFormState {
  score: Score | null;
  whoCarries: 'a' | 'b' | 'both' | null;
}

/** In-depth vote form state: all 6 dimensions, null = unanswered */
export interface InDepthFormState {
  isReal: boolean | null;
  accuracy: Accuracy | null;
  score: Score | null;
  wouldPlay: boolean | null;
  whoCarries: 'a' | 'b' | 'both' | null;
  difficulty: 1 | 2 | 3 | null;
}
