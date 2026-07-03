import {useState} from 'react';
import {COLORS, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../shared/constants';
import {DayGroup} from './DayGroup';
import {groupVotesByDay} from './activityStats';
import type {VoteLog} from './voteLogTypes';

interface ActivityViewProps {
  voteLog: VoteLog;
}

/**
 * Activity tab: the raw vote log rendered day by day. A voter filter narrows
 * the log to a single voter token before grouping; each day is a collapsible
 * DayGroup (the newest day starts open).
 */
export function ActivityView({voteLog}: ActivityViewProps) {
  const [voterFilter, setVoterFilter] = useState<number | null>(null);

  const filtered =
    voterFilter === null ? voteLog.votes : voteLog.votes.filter((v) => v.voter === voterFilter);
  const days = groupVotesByDay(filtered);
  const maxCount = Math.max(1, ...days.map((d) => d.count));

  const voterOptions = Array.from({length: voteLog.voterCount}, (_, i) => i + 1);

  return (
    <section>
      <header style={{marginBottom: SPACING.md}}>
        <h2 style={{fontSize: FONT_SIZES.xl, fontWeight: 700, margin: 0, color: COLORS.text}}>Activity</h2>
        <p style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, margin: `${SPACING.xs}px 0 0`}}>
          day by day - click a day to see every vote
        </p>
      </header>

      <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md}}>
        <label htmlFor="activity-voter-filter" style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted}}>
          Voter
        </label>
        <select
          id="activity-voter-filter"
          aria-label="Filter by voter"
          value={voterFilter ?? ''}
          onChange={(e) => setVoterFilter(e.target.value === '' ? null : Number(e.target.value))}
          style={{
            padding: '6px 8px',
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.surfaceBorder}`,
            fontSize: FONT_SIZES.base,
            fontFamily: FONTS.body,
            background: COLORS.surface,
            color: COLORS.text,
            cursor: 'pointer',
          }}>
          <option value="">All voters</option>
          {voterOptions.map((voter) => (
            <option key={voter} value={voter}>
              Voter {voter}
            </option>
          ))}
        </select>
      </div>

      {voteLog.votes.length === 0 ? (
        <div
          style={{
            padding: SPACING.md,
            background: COLORS.surfaceAlt,
            border: `1px dashed ${COLORS.surfaceBorder}`,
            borderRadius: RADIUS.lg,
            fontSize: FONT_SIZES.base,
            color: COLORS.textMuted,
          }}>
          No raw votes yet - set the service-role key and regenerate the artifact
        </div>
      ) : (
        <div>
          {days.map((day, i) => (
            <DayGroup key={day.day} group={day} maxCount={maxCount} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
