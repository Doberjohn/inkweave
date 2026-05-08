import {useNavigate} from 'react-router-dom';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONTS, RADIUS, SPACING, hexRgba} from '../../../shared/constants';
import {CommunityEmptyState} from './CommunityEmptyState';
import {ColumnHeader} from './ColumnHeader';
import {usePairScore} from '../../voting/hooks/usePairScore';
import {hasInDepthVote} from '../../voting/lib/voteStorage';
import {useCardModal} from '../../../shared/contexts/CardModalContext';
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
  const {closeCardModal} = useCardModal();
  const {score} = usePairScore(cardA.id, cardB.id);
  const userVotedInDepth = hasInDepthVote({cardA: cardA.id, cardB: cardB.id});
  const visual = deriveCommunityVisualState(score);

  const goToInDepthVote = () => {
    closeCardModal();
    navigate(`/vote/${cardA.id}/${cardB.id}`);
  };

  return (
    <section aria-label="Community signal" style={SECTION_STYLE}>
      <ColumnHeader
        title="Community"
        accentColor={COMMUNITY_TINT}
        score={visual.hasEmptyState ? '—' : formatScore(visual.communityScore)}
        scoreColor={COMMUNITY_TINT}
        scoreFontSize={42}
        showScale={!visual.hasEmptyState}
        meta={<CommunityHeaderMeta visual={visual} engineScore={engineScore} />}
      />
      <CommunityBody
        visual={visual}
        score={score}
        cardA={cardA}
        cardB={cardB}
        onCta={goToInDepthVote}
        userAlreadyVoted={userVotedInDepth}
      />
    </section>
  );
}

interface CommunityVisualState {
  totalVotes: number;
  scoreVotes: number;
  isFullEmpty: boolean;
  isHalfEmpty: boolean;
  hasEmptyState: boolean;
  communityScore: number | null;
}

/** Pure derivation: score + thresholds → display state shape. Keeps CommunityColumn declarative. */
function deriveCommunityVisualState(score: PairScore | null): CommunityVisualState {
  const totalVotes = score?.total_votes ?? 0;
  const scoreVotes = score?.score_votes ?? 0;
  const isFullEmpty = totalVotes < VOTES_THRESHOLD;
  const isHalfEmpty = !isFullEmpty && scoreVotes < VOTES_THRESHOLD;
  const hasEmptyState = isFullEmpty || isHalfEmpty;
  const communityScore = !hasEmptyState && score ? Number(score.avg_score) : null;
  return {totalVotes, scoreVotes, isFullEmpty, isHalfEmpty, hasEmptyState, communityScore};
}

const SECTION_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.section,
  padding: '16px 18px',
  border: `1px solid ${hexRgba(COMMUNITY_TINT, 0.25)}`,
  background: hexRgba(COMMUNITY_TINT, 0.04),
  borderRadius: 12,
  fontFamily: FONTS.body,
};

interface CommunityHeaderMetaProps {
  visual: CommunityVisualState;
  engineScore: number;
}

function CommunityHeaderMeta({visual, engineScore}: CommunityHeaderMetaProps) {
  if (visual.hasEmptyState) {
    return <EmptyStateVoteCount visual={visual} />;
  }
  return (
    <CommunityMeta
      engineScore={engineScore}
      communityScore={visual.communityScore}
      scoreVotes={visual.scoreVotes}
    />
  );
}

function EmptyStateVoteCount({visual}: {visual: CommunityVisualState}) {
  const count = visual.isFullEmpty ? visual.totalVotes : visual.scoreVotes;
  const label = visual.isFullEmpty ? 'votes' : 'in-depth votes';
  return (
    <span>
      {count} / {VOTES_THRESHOLD} {label}
    </span>
  );
}

interface CommunityBodyProps {
  visual: CommunityVisualState;
  score: PairScore | null;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  onCta: () => void;
  userAlreadyVoted: boolean;
}

function CommunityBody({visual, score, cardA, cardB, onCta, userAlreadyVoted}: CommunityBodyProps) {
  if (visual.hasEmptyState) {
    return (
      <CommunityEmptyState
        variant={visual.isFullEmpty ? 'full-empty' : 'half-empty'}
        current={visual.isFullEmpty ? visual.totalVotes : visual.scoreVotes}
        threshold={VOTES_THRESHOLD}
        onCta={onCta}
        userAlreadyVoted={userAlreadyVoted}
      />
    );
  }
  if (!score) return null;
  return <MetricRows score={score} cardA={cardA} cardB={cardB} />;
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
  return (
    <>
      <DeltaBadge delta={delta} />
      <VoteCount scoreVotes={scoreVotes} />
    </>
  );
}

type Delta = ReturnType<typeof formatDelta>;

/** Lower → red, higher → green, even → blue. */
function pickDeltaColor(tone: Delta['tone']): string {
  if (tone === 'lower') return '#f59090';
  if (tone === 'higher') return '#6ee7a0';
  return '#60b5f5';
}

function DeltaBadge({delta}: {delta: Delta}) {
  if (delta.arrow === null) return null;
  const color = pickDeltaColor(delta.tone);
  return (
    <>
      <span
        aria-label={`${delta.value} ${delta.tone} than the engine score`}
        style={{
          background: hexRgba(color, 0.15),
          color,
          padding: '2px 7px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 'normal',
          textTransform: 'none',
        }}>
        {delta.arrow} {delta.value}
      </span>
      <span aria-hidden="true" style={{opacity: 0.5, fontWeight: 700}}>·</span>
    </>
  );
}

function VoteCount({scoreVotes}: {scoreVotes: number}) {
  return (
    <span>
      {scoreVotes} {scoreVotes === 1 ? 'vote' : 'votes'}
    </span>
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
        gap: SPACING.section,
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
