import type {LorcanaCard, PairSynergyConnection} from 'inkweave-synergy-engine';
import type {Score} from '../../shared/lib/supabase';

/** Raw entry from _pairs_index.json: [cardA_id, cardB_id, aggregateScore] */
export type PairIndexEntry = [string, string, number];

/** Resolved pair ready for display */
export interface VotingPair {
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  aggregateScore: number;
  connections: PairSynergyConnection[];
}

/** Vote form state */
export interface VoteFormState {
  score: Score | null;
  whoCarries: 'a' | 'b' | 'both' | null;
}
