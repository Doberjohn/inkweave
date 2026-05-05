import {useNavigate} from 'react-router-dom';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONTS, RADIUS, SPACING, hexRgba} from '../../../shared/constants';
import {CommunityEmptyState} from './CommunityEmptyState';
import {ColumnHeader} from './ColumnHeader';
import {usePairScore} from '../../voting/hooks/usePairScore';
import type {PairScore} from '../../../shared/lib/supabase';
import {
  formatPercent,
  formatScore,
  formatDelta,
  pickDriver,
  realCopy,
  wouldPlayCopy,
  difficultyCopy,
  driverCopy,
} from '../../../shared/utils/scoreFormatting';

const VOTES_THRESHOLD = 5;
const COMMUNITY_TINT = '#b691ff'; // amethyst

interface CommunityColumnProps {
  pair: DetailedPairSynergy;
  engineScore: number;
}

/**
 * Right-column container for the synergy detail modal.
 *
 * Renders an amethyst-tinted panel with: score header (community avg / 10 + delta vs engine + vote count),
 * then either four metric rows (Real / Would Play / Difficulty / Driver) when populated, or a
 * <CommunityEmptyState> when total_votes < 5 (full-empty) or score_votes < 5 (half-empty).
 *
 * Distribution bar + QuickVoteControl live in <EngineColumn>, not here — the community column
 * shows what the community thinks; the vote action belongs next to the engine score it rates.
 */
export function CommunityColumn({pair, engineScore}: CommunityColumnProps) {
  const {cardA, cardB} = pair;
  const navigate = useNavigate();
  const {score} = usePairScore(cardA.id, cardB.id);

  const totalVotes = score?.total_votes ?? 0;
  const scoreVotes = score?.score_votes ?? 0;
  const isFullEmpty = totalVotes < VOTES_THRESHOLD;
  const isHalfEmpty = !isFullEmpty && scoreVotes < VOTES_THRESHOLD;
  const hasEmptyState = isFullEmpty || isHalfEmpty;
  const communityScore = !hasEmptyState && score ? Number(score.avg_score) : null;

  const goToInDepthVote = () => navigate(`/vote/${cardA.id}/${cardB.id}`);

  return (
    <section
      aria-label="Community signal"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '16px 18px',
        border: `1px solid ${hexRgba(COMMUNITY_TINT, 0.25)}`,
        background: hexRgba(COMMUNITY_TINT, 0.04),
        borderRadius: 12,
        fontFamily: FONTS.body,
      }}>
      <ColumnHeader
        title="Community"
        accentColor={COMMUNITY_TINT}
        score={hasEmptyState ? '—' : formatScore(communityScore)}
        scoreColor={COMMUNITY_TINT}
        scoreFontSize={42}
        showScale={!hasEmptyState}
        meta={
          hasEmptyState ? (
            <span>
              {isFullEmpty ? totalVotes : scoreVotes} / {VOTES_THRESHOLD}{' '}
              {isFullEmpty ? 'votes' : 'in-depth votes'}
            </span>
          ) : (
            <CommunityMeta
              engineScore={engineScore}
              communityScore={communityScore}
              scoreVotes={scoreVotes}
            />
          )
        }
      />
      {hasEmptyState ? (
        <CommunityEmptyState
          variant={isFullEmpty ? 'full-empty' : 'half-empty'}
          current={isFullEmpty ? totalVotes : scoreVotes}
          threshold={VOTES_THRESHOLD}
          onCta={goToInDepthVote}
        />
      ) : score ? (
        <MetricRows score={score} cardA={cardA} cardB={cardB} />
      ) : null}
    </section>
  );
}

function CommunityMeta({
  engineScore,
  communityScore,
  scoreVotes,
}: {
  engineScore: number;
  communityScore: number | null;
  scoreVotes: number;
}) {
  const delta = formatDelta(engineScore, communityScore);
  const showDelta = delta.arrow !== null;
  const deltaColor =
    delta.tone === 'lower' ? '#f59090' : delta.tone === 'higher' ? '#60b5f5' : '#6ee7a0';

  return (
    <>
      {showDelta && (
        <span
          aria-label={`${delta.value} ${delta.tone} than the engine score`}
          style={{
            background: hexRgba(deltaColor, 0.15),
            color: deltaColor,
            padding: '2px 7px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 'normal',
            textTransform: 'none',
          }}>
          {delta.arrow} {delta.value}
        </span>
      )}
      {showDelta && (
        <span aria-hidden="true" style={{opacity: 0.5, fontWeight: 700}}>
          ·
        </span>
      )}
      <span>
        {scoreVotes} {scoreVotes === 1 ? 'vote' : 'votes'}
      </span>
    </>
  );
}

interface MetricRowsProps {
  score: PairScore;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
}

function MetricRows({score, cardA, cardB}: MetricRowsProps) {
  const real = realCopy(score.pct_real);
  const wouldPlay = wouldPlayCopy(score.pct_would_play);
  const difficulty = difficultyCopy(
    score.avg_difficulty != null ? Number(score.avg_difficulty) : null,
  );
  const driver = driverCopy(pickDriver(score), cardA, cardB);

  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
      {real && (
        <MetricRow
          value={formatPercent(score.pct_real)}
          label={real.title}
          description={real.description}
        />
      )}
      {wouldPlay && (
        <MetricRow
          value={formatPercent(score.pct_would_play)}
          label={wouldPlay.title}
          description={wouldPlay.description}
        />
      )}
      {difficulty && (
        <MetricRow
          value={formatScore(
            score.avg_difficulty != null ? Number(score.avg_difficulty) : null,
          )}
          label={difficulty.title}
          description={difficulty.description}
        />
      )}
      {driver && (
        <MetricRow value={driver.value} label="Driver" description={driver.description} />
      )}
    </div>
  );
}

function MetricRow({
  value,
  label,
  description,
}: {
  value: string;
  label: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        padding: '12px 14px',
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
        minHeight: 64,
      }}>
      <div
        style={{
          flex: '0 0 80px',
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.text,
          textAlign: 'center',
          lineHeight: 1,
        }}>
        {value}
      </div>
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0}}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: COLORS.descriptionText,
            lineHeight: 1.4,
          }}>
          {description}
        </div>
      </div>
    </div>
  );
}
