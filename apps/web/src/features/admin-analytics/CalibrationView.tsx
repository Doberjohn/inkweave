import {useRef, useState} from 'react';
import {COLORS, FONT_SIZES, SPACING} from '../../shared/constants';
import {useContainerWidth} from '../../shared/hooks';
import {VerdictHero} from './VerdictHero';
import {Scorecard, ScorecardRow} from './Scorecard';
import {RuleCalibrationTable} from './RuleCalibrationTable';
import {PairList} from './PairList';
import {VoteDetailTable} from './VoteDetailTable';
import {WeeklyActivityChart} from './WeeklyActivityChart';
import {DimensionParticipation} from './DimensionParticipation';
import {RawVotesNotice} from './RawVotesNotice';
import type {GlobalStats, PairStat, RuleStat, VoteAnalytics} from './voteAnalyticsTypes';
import type {VoteLog, VoteLogRow} from './voteLogTypes';

interface CalibrationViewProps {
  analytics: VoteAnalytics;
  voteLog: VoteLog;
}

type SelectedPair = {a: string; b: string};

/** Below this container width the two-column pair inspector stacks vertically. */
const STACK_WIDTH = 720;
/** Most gaps are near zero; showing the widest-gap pairs first surfaces the outliers worth reviewing. */
const MAX_PAIRS = 40;

const num = (n: number) => n.toLocaleString('en-US');

/** Widest-gap first, capped, scoped to the selected rule when one is active. */
function selectPairs(pairs: PairStat[], ruleId: string | null): PairStat[] {
  const scoped = ruleId ? pairs.filter((p) => p.rules.includes(ruleId)) : pairs;
  return [...scoped].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, MAX_PAIRS);
}

/** The selected pair's display fields for the vote-detail heading, or null. */
function findPairData(pairs: PairStat[], sel: SelectedPair | null) {
  if (!sel) return null;
  const found = pairs.find((p) => p.a === sel.a && p.b === sel.b);
  return found ? {aName: found.aName, bName: found.bName, engineScore: found.engineScore} : null;
}

/** Raw votes for the selected pair (empty when nothing is selected). */
function filterVotes(votes: VoteLogRow[], sel: SelectedPair | null): VoteLogRow[] {
  return sel ? votes.filter((v) => v.a === sel.a && v.b === sel.b) : [];
}

/** Right-column header: the selected rule's name + gap + votes, or "All pairs". */
function formatHeaderLine(rule: RuleStat | null): string {
  if (!rule) return 'All pairs';
  const gap = rule.meanGap == null ? '—' : (rule.meanGap > 0 ? '+' : '') + rule.meanGap.toFixed(2);
  return `${rule.ruleName} · gap ${gap} · ${num(rule.scoreVotes)} votes`;
}

/** The top scorecards; the voters card only appears when raw votes are present. */
function StatStrip({g, hasRawVotes}: {g: GlobalStats; hasRawVotes: boolean}) {
  return (
    <ScorecardRow>
      <Scorecard value={num(g.totalVotes)} label="Total votes" />
      <Scorecard value={num(g.distinctPairs)} label="Pairs covered" />
      <Scorecard value={num(g.engineSilentPairs)} label="Engine-silent pairs" hint="voted, no synergy" emphasis />
      {hasRawVotes && g.distinctVoters != null && (
        <Scorecard value={num(g.distinctVoters)} label="Distinct voters" rawTag />
      )}
    </ScorecardRow>
  );
}

/** The raw-votes activity strip (weekly + dimension), or the enable hint when absent. */
function SecondaryStrip({
  g,
  hasRawVotes,
  latestDate,
  stacked,
}: {
  g: GlobalStats;
  hasRawVotes: boolean;
  latestDate?: string;
  stacked: boolean;
}) {
  if (!hasRawVotes) return <RawVotesNotice />;
  return (
    <div style={{display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1fr 1fr', gap: SPACING.lg}}>
      <WeeklyActivityChart weekly={g.weekly} latestDate={latestDate} />
      <DimensionParticipation fill={g.dimensionFill} totalVotes={g.totalVotes} />
    </div>
  );
}

/**
 * The Calibration tab body: a verdict hero, a stat strip, a two-column
 * rule → pair → vote drill-down, and a raw-votes activity strip. Purely
 * presentational — all selection lives in local state, and the data comes in
 * via props (fetched by the page).
 */
export function CalibrationView({analytics, voteLog}: CalibrationViewProps) {
  const g = analytics.global;
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [selectedPair, setSelectedPair] = useState<SelectedPair | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);
  const stacked = width > 0 && width < STACK_WIDTH;

  // Selecting a rule scopes the pair list to that rule and clears any prior pair.
  const handleSelectRule = (ruleId: string) => {
    setSelectedRuleId(ruleId);
    setSelectedPair(null);
  };

  // Computed directly (no useMemo): the React Compiler auto-memoizes, and these
  // feed render, not a sync-setState effect, so there is no loop risk.
  const selectedRule = analytics.rules.find((r) => r.ruleId === selectedRuleId) ?? null;
  const pairsForRule = selectPairs(analytics.pairs, selectedRuleId);
  const selectedPairData = findPairData(analytics.pairs, selectedPair);
  const votesForPair = filterVotes(voteLog.votes, selectedPair);

  return (
    <div ref={containerRef}>
      <VerdictHero meanGap={g.meanGap} accuracySentiment={g.accuracySentiment} />

      <StatStrip g={g} hasRawVotes={analytics.hasRawVotes} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: stacked ? '1fr' : '1.5fr 1fr',
          gap: SPACING.lg,
          marginBottom: SPACING.section,
          alignItems: 'start',
        }}>
        <RuleCalibrationTable rules={analytics.rules} selectedRuleId={selectedRuleId} onSelectRule={handleSelectRule} />
        <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.md}}>
          <div style={{fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontWeight: 600, letterSpacing: '0.03em'}}>
            {formatHeaderLine(selectedRule)}
          </div>
          <div style={{maxHeight: 480, overflowY: 'auto'}}>
            <PairList pairs={pairsForRule} selectedPair={selectedPair} onSelectPair={setSelectedPair} />
          </div>
          <VoteDetailTable pair={selectedPairData} votes={votesForPair} />
        </div>
      </div>

      <SecondaryStrip
        g={g}
        hasRawVotes={analytics.hasRawVotes}
        latestDate={voteLog.votes[0]?.ts?.slice(0, 10)}
        stacked={stacked}
      />
    </div>
  );
}
