import type {Ink} from 'inkweave-synergy-engine';
import {trackEvent} from '../../../shared/lib/analytics';
import type {VotingPair} from '../types';

/**
 * The three distinct vote surfaces, each its own UI:
 * - `quick`   — the ±accuracy thumbs on the card-detail comparison (EngineColumn).
 * - `score`   — the one-click 1-10 rating on the /vote swipe page (VotePage).
 * - `in_depth`— the multi-dimension form on the in-depth vote page.
 */
export type VoteType = 'quick' | 'score' | 'in_depth';

export interface VoteSubmittedInput {
  voteType: VoteType;
  cardAId: string;
  cardBId: string;
  /** Primary ink of each card. Null only when a surface can't resolve the card object. */
  cardAInk: Ink | null;
  cardBInk: Ink | null;
  /** The engine's precomputed synergy score (1-10) — the value the user is reacting to. */
  engineScore: number | null;
  /** Number of synergy rules connecting the pair. */
  synergyCount: number | null;
  /**
   * The user's vote value. Meaning depends on `voteType` — always read it split by voteType:
   * `quick` → accuracy (-1 too low / 0 right / 1 too high); `score` & `in_depth` → 1-10 score.
   * Null when the surface submitted no numeric value (e.g. an in-depth vote with no score).
   */
  userScore: number | null;
}

/**
 * Fire the enriched `vote_submitted` event. Centralised so every vote surface emits
 * one identical 8-property shape rather than each hand-rolling its own props.
 */
export function trackVoteSubmitted(input: VoteSubmittedInput): void {
  trackEvent('vote_submitted', {
    voteType: input.voteType,
    cardAId: input.cardAId,
    cardBId: input.cardBId,
    cardAInk: input.cardAInk,
    cardBInk: input.cardBInk,
    engineScore: input.engineScore,
    synergyCount: input.synergyCount,
    userScore: input.userScore,
  });
}

/**
 * Convenience for the two surfaces that already hold a fully-resolved `VotingPair`
 * (the /vote score page and the in-depth form): derive every card/engine property
 * from the pair so the call site only supplies the vote type and the user's value.
 */
export function trackPairVote(
  voteType: VoteType,
  pair: VotingPair,
  userScore: number | null,
): void {
  trackVoteSubmitted({
    voteType,
    cardAId: pair.cardA.id,
    cardBId: pair.cardB.id,
    cardAInk: pair.cardA.ink,
    cardBInk: pair.cardB.ink,
    engineScore: pair.aggregateScore,
    synergyCount: pair.connections.length,
    userScore,
  });
}
