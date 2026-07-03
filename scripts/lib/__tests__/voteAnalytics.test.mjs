import {describe, it, expect} from 'vitest';
import {pairKey} from '../voteAnalytics.mjs';

describe('pairKey', () => {
  it('orders the two ids canonically (a < b)', () => {
    expect(pairKey('b2', 'a1')).toBe('a1:b2');
    expect(pairKey('a1', 'b2')).toBe('a1:b2');
  });
});

import {computePairRecord, buildPairRecords, voteWeightedMean, rollUpByRule, isoWeekStart, bucketWeekly, buildAnalytics, buildVoteLog} from '../voteAnalytics.mjs';

const enginePair = {
  engineScore: 7,
  connections: [{ruleId: 'ramp'}, {ruleId: 'toy'}],
};
const score = {
  card_a_id: 'a1', card_b_id: 'b2',
  avg_score: 9.3, score_votes: 4, accuracy_sentiment: -0.5,
};
const names = new Map([['a1', 'Card One'], ['b2', 'Card Two']]);

describe('computePairRecord', () => {
  it('gap = community minus engine; positive means engine under-rates', () => {
    const rec = computePairRecord(score, enginePair, names);
    expect(rec.gap).toBe(2.3);
    expect(rec.engineScore).toBe(7);
    expect(rec.communityScore).toBe(9.3);
    expect(rec.rules).toEqual(['ramp', 'toy']);
    expect(rec.aName).toBe('Card One');
    expect(rec.engineSilent).toBe(false);
  });

  it('flags engine-silent pairs (no engine entry) with null gap', () => {
    const rec = computePairRecord(score, undefined, names);
    expect(rec.engineSilent).toBe(true);
    expect(rec.gap).toBeNull();
    expect(rec.engineScore).toBeNull();
  });

  it('returns null when the pair has no score vote', () => {
    const noScore = {...score, avg_score: null, score_votes: 0};
    expect(computePairRecord(noScore, enginePair, names)).toBeNull();
  });
});

describe('voteWeightedMean', () => {
  it('weights each value by its weight', () => {
    // (2*1 + 0*3) / (1+3) = 0.5
    expect(voteWeightedMean([{v: 2, w: 1}, {v: 0, w: 3}], (x) => x.v, (x) => x.w)).toBe(0.5);
  });
  it('returns null for empty input or zero total weight', () => {
    expect(voteWeightedMean([], (x) => x.v, (x) => x.w)).toBeNull();
    expect(voteWeightedMean([{v: 5, w: 0}], (x) => x.v, (x) => x.w)).toBeNull();
  });
});

describe('buildPairRecords', () => {
  it('splits gap-defined pairs from engine-silent ones, drops scoreless rows', () => {
    const scores = [
      {card_a_id: 'a1', card_b_id: 'b2', avg_score: 9, score_votes: 2, accuracy_sentiment: 0},
      {card_a_id: 'c3', card_b_id: 'd4', avg_score: 5, score_votes: 1, accuracy_sentiment: 0}, // engine-silent
      {card_a_id: 'e5', card_b_id: 'f6', avg_score: null, score_votes: 0, accuracy_sentiment: 0}, // dropped
    ];
    const enginePairs = new Map([['a1:b2', {engineScore: 7, connections: [{ruleId: 'ramp'}]}]]);
    const names = new Map();
    const {pairs, engineSilent} = buildPairRecords(scores, enginePairs, names);
    expect(pairs.map((p) => p.a)).toEqual(['a1']);
    expect(engineSilent.map((p) => p.a)).toEqual(['c3']);
  });
});

describe('rollUpByRule', () => {
  const allRules = [
    {ruleId: 'ramp', ruleName: 'Ramp', category: 'playstyle'},
    {ruleId: 'toy', ruleName: 'Toy', category: 'playstyle'},
    {ruleId: 'shift', ruleName: 'Shift Targets', category: 'direct'},
  ];
  const pairs = [
    {gap: 2, scoreVotes: 3, accuracySentiment: -1, rules: ['ramp', 'toy']},
    {gap: -1, scoreVotes: 1, accuracySentiment: 0, rules: ['ramp']},
  ];
  const ruleTotalPairs = {ramp: 20, toy: 10, shift: 5};

  it('credits each pair to every rule that fired, vote-weighted', () => {
    const rules = rollUpByRule(pairs, allRules, ruleTotalPairs);
    const ramp = rules.find((r) => r.ruleId === 'ramp');
    // (2*3 + -1*1) / (3+1) = 1.25
    expect(ramp.meanGap).toBe(1.25);
    expect(ramp.scoreVotes).toBe(4);
    expect(ramp.pairsVoted).toBe(2);
    expect(ramp.pairsCovered).toBe(0.1); // 2 / 20
  });

  it('emits zero-vote rules with null meanGap so coverage gaps are visible', () => {
    const rules = rollUpByRule(pairs, allRules, ruleTotalPairs);
    const shift = rules.find((r) => r.ruleId === 'shift');
    expect(shift.scoreVotes).toBe(0);
    expect(shift.meanGap).toBeNull();
    expect(shift.pairsVoted).toBe(0);
  });

  it('reports pairsCovered 0 when the rule is absent from ruleTotalPairs (no divide path)', () => {
    // `toy` has a voted pair but is missing from this totals map -> totalPairs falls back to 0.
    const rules = rollUpByRule(pairs, allRules, {ramp: 20, shift: 5});
    const toy = rules.find((r) => r.ruleId === 'toy');
    expect(toy.pairsVoted).toBe(1);
    expect(toy.pairsCovered).toBe(0);
  });
});

describe('isoWeekStart', () => {
  it('returns the Monday (UTC) of the week as YYYY-MM-DD', () => {
    // 2026-06-30 is a Tuesday -> Monday 2026-06-29
    expect(isoWeekStart('2026-06-30T05:08:56.000Z')).toBe('2026-06-29');
    expect(isoWeekStart('2026-06-29T00:00:00.000Z')).toBe('2026-06-29');
  });

  it('maps Sunday back to the preceding Monday', () => {
    // 2026-06-28 is a Sunday -> preceding Monday 2026-06-22
    expect(isoWeekStart('2026-06-28T05:00:00.000Z')).toBe('2026-06-22');
  });
});

describe('bucketWeekly', () => {
  it('counts votes per week and vote-weighted mean gap of scored votes', () => {
    const rawVotes = [
      {created_at: '2026-06-29T01:00:00.000Z', card_a_id: 'a1', card_b_id: 'b2', score: 9},
      {created_at: '2026-06-30T01:00:00.000Z', card_a_id: 'a1', card_b_id: 'b2', score: 7},
      {created_at: '2026-06-30T02:00:00.000Z', card_a_id: 'c3', card_b_id: 'd4', score: null}, // no score
    ];
    const enginePairs = new Map([['a1:b2', {engineScore: 7, connections: []}]]);
    const weekly = bucketWeekly(rawVotes, enginePairs);
    expect(weekly).toEqual([{week: '2026-06-29', votes: 3, meanGap: 1}]);
    // gaps: (9-7)=2 and (7-7)=0, equal weight -> mean 1; third vote counts in `votes` only
  });

  it('buckets votes spanning two weeks, sorted ascending by week', () => {
    const rawVotes = [
      // later week first to prove the sort reorders them
      {created_at: '2026-06-30T01:00:00.000Z', card_a_id: 'a1', card_b_id: 'b2', score: 8},
      {created_at: '2026-06-22T01:00:00.000Z', card_a_id: 'a1', card_b_id: 'b2', score: 9},
    ];
    const enginePairs = new Map([['a1:b2', {engineScore: 7, connections: []}]]);
    const weekly = bucketWeekly(rawVotes, enginePairs);
    expect(weekly).toEqual([
      {week: '2026-06-22', votes: 1, meanGap: 2}, // 9-7
      {week: '2026-06-29', votes: 1, meanGap: 1}, // 8-7
    ]);
  });
});

describe('buildAnalytics', () => {
  const scoreRows = [
    {card_a_id: 'a1', card_b_id: 'b2', avg_score: 9, score_votes: 2, total_votes: 2, accuracy_sentiment: 0},
  ];
  const enginePairs = new Map([['a1:b2', {engineScore: 7, connections: [{ruleId: 'ramp'}]}]]);
  const allRules = [{ruleId: 'ramp', ruleName: 'Ramp', category: 'playstyle'}];
  const names = new Map([['a1', 'A'], ['b2', 'B']]);
  const ruleTotalPairs = {ramp: 4};

  it('assembles global+rules+pairs from pair_scores alone (no raw votes)', () => {
    const out = buildAnalytics({scoreRows, enginePairs, allRules, names, ruleTotalPairs, rawVotes: null});
    expect(out.hasRawVotes).toBe(false);
    expect(out.global.totalVotes).toBe(2);
    expect(out.global.distinctPairs).toBe(1);
    expect(out.global.distinctVoters).toBeNull();
    expect(out.global.meanGap).toBe(2);
    expect(out.global.weekly).toEqual([]);
    expect(out.global.dimensionFill).toBeNull();
    expect(out.rules[0].meanGap).toBe(2);
    expect(out.pairs[0].gap).toBe(2);
  });

  it('adds weekly/voters/dimensionFill when raw votes are supplied', () => {
    const rawVotes = [
      {created_at: '2026-06-29T01:00:00.000Z', ip_hash: 'x', card_a_id: 'a1', card_b_id: 'b2',
       score: 9, accuracy: null, is_real: null, would_play: null, difficulty: 1},
    ];
    const out = buildAnalytics({scoreRows, enginePairs, allRules, names, ruleTotalPairs, rawVotes});
    expect(out.hasRawVotes).toBe(true);
    expect(out.global.distinctVoters).toBe(1);
    expect(out.global.weekly.length).toBe(1);
    expect(out.global.dimensionFill).toEqual({score: 1, accuracy: 0, isReal: 0, wouldPlay: 0, difficulty: 1});
  });
});

describe('buildVoteLog', () => {
  const names = new Map([['a1', 'Card One'], ['b2', 'Card Two']]);
  const raw = (over) => ({
    ip_hash: 'ip-a', card_a_id: 'a1', card_b_id: 'b2',
    score: 7, accuracy: 1, is_real: true, would_play: false, difficulty: 2,
    who_carries: 'a', created_at: '2026-06-29T01:00:00.000Z', ...over,
  });

  it('assigns first-seen sequential voter tokens; same ip -> same token, new ip -> next integer', () => {
    const {votes, voterCount} = buildVoteLog(
      [
        raw({ip_hash: 'ip-a', created_at: '2026-06-29T01:00:00.000Z'}),
        raw({ip_hash: 'ip-b', created_at: '2026-06-29T02:00:00.000Z'}),
        raw({ip_hash: 'ip-a', created_at: '2026-06-29T03:00:00.000Z'}),
      ],
      names,
    );
    // newest-first: ip-a(3h), ip-b(2h), ip-a(1h) -> tokens by first-seen: ip-a=1, ip-b=2
    expect(votes.map((v) => v.voter)).toEqual([1, 2, 1]);
    expect(voterCount).toBe(2);
  });

  it('never leaks ip_hash into any output row', () => {
    const {votes} = buildVoteLog([raw()], names);
    expect(votes[0]).not.toHaveProperty('ip_hash');
    expect(Object.values(votes[0])).not.toContain('ip-a');
  });

  it('canonicalizes pair order so a < b regardless of input order', () => {
    const {votes} = buildVoteLog([raw({card_a_id: 'b2', card_b_id: 'a1'})], names);
    expect(votes[0].a).toBe('a1');
    expect(votes[0].b).toBe('b2');
    expect(votes[0].aName).toBe('Card One');
    expect(votes[0].bName).toBe('Card Two');
  });

  it('sorts newest-first by ts', () => {
    const {votes} = buildVoteLog(
      [
        raw({created_at: '2026-06-29T01:00:00.000Z'}),
        raw({created_at: '2026-06-30T01:00:00.000Z'}),
        raw({created_at: '2026-06-28T01:00:00.000Z'}),
      ],
      names,
    );
    expect(votes.map((v) => v.ts)).toEqual([
      '2026-06-30T01:00:00.000Z',
      '2026-06-29T01:00:00.000Z',
      '2026-06-28T01:00:00.000Z',
    ]);
  });

  it('resolves names via the map and carries every dimension (snake -> camel)', () => {
    const {votes} = buildVoteLog([raw()], names);
    expect(votes[0]).toEqual({
      a: 'a1', b: 'b2', aName: 'Card One', bName: 'Card Two',
      score: 7, accuracy: 1, isReal: true, wouldPlay: false,
      difficulty: 2, whoCarries: 'a', ts: '2026-06-29T01:00:00.000Z', voter: 1,
    });
  });

  it('falls back to the id when the name is not in the map', () => {
    const {votes} = buildVoteLog([raw({card_a_id: 'zz', card_b_id: 'a1'})], names);
    // canonical order: 'a1' < 'zz' -> a='a1', b='zz'; zz has no name -> falls back to id
    expect(votes[0].bName).toBe('zz');
  });
});
