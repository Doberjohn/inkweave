/**
 * Pure transforms for the vote-analytics precompute. No I/O — every function
 * takes plain data and returns plain data so they unit-test in isolation.
 */

/** Canonical pair key: the two card ids sorted, joined by ':'. */
export function pairKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Round to 2 decimals, returning a number (not a string). */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Join one pair_scores row to its engine pair.
 * Returns null if the pair has no community score vote.
 * gap = communityScore - engineScore (positive ⇒ engine under-rates).
 * engineSilent pairs (no engine entry) carry a null gap.
 */
export function computePairRecord(scoreRow, enginePair, names) {
  if (scoreRow.avg_score == null || !scoreRow.score_votes) return null;

  const a = scoreRow.card_a_id;
  const b = scoreRow.card_b_id;
  const communityScore = round2(scoreRow.avg_score);
  const engineSilent = !enginePair;
  const engineScore = engineSilent ? null : enginePair.engineScore;
  const gap = engineSilent ? null : round2(communityScore - engineScore);

  return {
    a, b,
    aName: names.get(a) ?? a,
    bName: names.get(b) ?? b,
    engineScore,
    communityScore,
    gap,
    scoreVotes: scoreRow.score_votes,
    accuracySentiment: scoreRow.accuracy_sentiment ?? null,
    rules: engineSilent ? [] : enginePair.connections.map((c) => c.ruleId),
    engineSilent,
  };
}

/** Weighted mean of `items` by `valueFn`/`weightFn`; null if total weight is 0. */
export function voteWeightedMean(items, valueFn, weightFn) {
  let num = 0;
  let den = 0;
  for (const item of items) {
    const w = weightFn(item);
    num += valueFn(item) * w;
    den += w;
  }
  return den === 0 ? null : num / den;
}

/**
 * Map pair_scores rows to pair records, splitting gap-defined pairs from
 * engine-silent ones. `enginePairs` is a Map keyed by pairKey(a,b).
 */
export function buildPairRecords(scoreRows, enginePairs, names) {
  const pairs = [];
  const engineSilent = [];
  for (const row of scoreRows) {
    const enginePair = enginePairs.get(pairKey(row.card_a_id, row.card_b_id));
    const rec = computePairRecord(row, enginePair, names);
    if (!rec) continue;
    (rec.engineSilent ? engineSilent : pairs).push(rec);
  }
  return {pairs, engineSilent};
}

/** Append `value` to the array stored at `key`, creating the array if absent. */
function appendToGroup(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

/**
 * Roll pair records up to per-rule calibration stats. A pair is credited to
 * EVERY rule in its `rules` list (a vote is feedback on the whole displayed
 * score, which multiple rules built). meanGap is vote-weighted by scoreVotes.
 * Every rule in `allRules` is emitted, even with zero votes.
 *
 * Precondition: `pairRecords` is expected to contain only gap-defined
 * (non-engine-silent) pairs, as produced by `buildPairRecords().pairs`. The
 * `gap != null` filter is a defensive safety net for direct callers that
 * might pass engine-silent records.
 */
export function rollUpByRule(pairRecords, allRules, ruleTotalPairs) {
  // ruleId -> pair records that fired it (only gap-defined pairs contribute)
  const byRule = new Map();
  for (const rec of pairRecords.filter((r) => r.gap != null)) {
    for (const ruleId of rec.rules) appendToGroup(byRule, ruleId, rec);
  }

  return allRules.map((rule) => {
    const recs = byRule.get(rule.ruleId) ?? [];
    const totalPairs = ruleTotalPairs[rule.ruleId] ?? 0;
    return {
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      category: rule.category,
      scoreVotes: recs.reduce((s, r) => s + r.scoreVotes, 0),
      pairsVoted: recs.length,
      meanGap: voteWeightedMean(recs, (r) => r.gap, (r) => r.scoreVotes),
      accuracySentiment: voteWeightedMean(
        recs.filter((r) => r.accuracySentiment != null),
        (r) => r.accuracySentiment,
        (r) => r.scoreVotes,
      ),
      pairsCovered: totalPairs === 0 ? 0 : recs.length / totalPairs,
    };
  });
}

/** UTC Monday of the given timestamp's week, as YYYY-MM-DD. */
export function isoWeekStart(timestamp) {
  const d = new Date(timestamp);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

/** Accumulate one raw vote into its ISO-week bucket (votes count + optional gap). */
function accrueVote(weeks, vote, enginePairs) {
  const week = isoWeekStart(vote.created_at);
  if (!weeks.has(week)) weeks.set(week, {votes: 0, gapItems: []});
  const bucket = weeks.get(week);
  bucket.votes += 1;
  if (vote.score == null) return;
  const enginePair = enginePairs.get(pairKey(vote.card_a_id, vote.card_b_id));
  if (enginePair) bucket.gapItems.push({gap: round2(vote.score - enginePair.engineScore)});
}

/**
 * Bucket raw votes by ISO week. `votes` counts all votes; `meanGap` is the
 * vote-weighted (equal-weight) mean gap of votes that carry a score AND map to
 * an engine pair. Weeks sorted ascending.
 */
export function bucketWeekly(rawVotes, enginePairs) {
  const weeks = new Map(); // week -> {votes, gapItems: [{gap}]}
  for (const v of rawVotes) accrueVote(weeks, v, enginePairs);
  return [...weeks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([week, {votes, gapItems}]) => ({
      week,
      votes,
      meanGap: voteWeightedMean(gapItems, (x) => x.gap, () => 1),
    }));
}

function countFilled(rawVotes, key) {
  return rawVotes.reduce((n, v) => n + (v[key] != null ? 1 : 0), 0);
}

/** Assemble the `global` block. `rawVotes` may be null (no service-role key). */
export function computeGlobal({scoreRows, pairs, engineSilent, rawVotes, enginePairs}) {
  const totalVotes = scoreRows.reduce((s, r) => s + (r.total_votes ?? 0), 0);
  const meanGap = voteWeightedMean(pairs, (p) => p.gap, (p) => p.scoreVotes);
  const accuracySentiment = voteWeightedMean(
    pairs.filter((p) => p.accuracySentiment != null),
    (p) => p.accuracySentiment,
    (p) => p.scoreVotes,
  );

  const base = {
    totalVotes,
    distinctPairs: scoreRows.length,
    distinctVoters: null,
    meanGap: meanGap == null ? null : round2(meanGap),
    accuracySentiment: accuracySentiment == null ? null : round2(accuracySentiment),
    engineSilentPairs: engineSilent.length,
    weekly: [],
    dimensionFill: null,
  };

  if (!rawVotes) return base;
  return {
    ...base,
    distinctVoters: new Set(rawVotes.map((v) => v.ip_hash)).size,
    weekly: bucketWeekly(rawVotes, enginePairs),
    dimensionFill: {
      score: countFilled(rawVotes, 'score'),
      accuracy: countFilled(rawVotes, 'accuracy'),
      isReal: countFilled(rawVotes, 'is_real'),
      wouldPlay: countFilled(rawVotes, 'would_play'),
      difficulty: countFilled(rawVotes, 'difficulty'),
    },
  };
}

/**
 * Top-level: produce the full vote-analytics artifact (minus generatedAt).
 * The caller (orchestrator) merges a `generatedAt` ISO timestamp into the
 * returned object before writing it to disk.
 */
export function buildAnalytics({scoreRows, enginePairs, allRules, names, ruleTotalPairs, rawVotes}) {
  const {pairs, engineSilent} = buildPairRecords(scoreRows, enginePairs, names);
  const global = computeGlobal({scoreRows, pairs, engineSilent, rawVotes, enginePairs});
  const rules = rollUpByRule(pairs, allRules, ruleTotalPairs);
  // Stable, useful ordering: largest |gap| first.
  const sortedPairs = [...pairs].sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap));
  return {hasRawVotes: Boolean(rawVotes), global, rules, pairs: sortedPairs};
}
