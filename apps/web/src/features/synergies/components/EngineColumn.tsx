import type {DetailedPairSynergy} from 'inkweave-synergy-engine';
import {ColumnHeader} from './ColumnHeader';
import {ConnectionGroup, groupConnections} from '../../../shared/components';
import {QuickVoteControl} from '../../voting/components';
import {useQuickVote} from '../../voting/hooks';
import {COLORS, FONTS, GOLD_GLOW, SHADOWS, SPACING} from '../../../shared/constants';

const ENGINE_TINT = COLORS.primary;

interface EngineColumnProps {
  pair: DetailedPairSynergy;
  engineScore: number;
  onHighlight?: (id: 'a' | 'b' | null) => void;
  /**
   * Compact mode for the mobile comparison view (#332 #5). Skips the ColumnHeader and outer
   * tinted panel wrapper — the tab pill above already carries the title + score, and the
   * MobileComparisonView panel container owns the surrounding spacing/padding. Renders just
   * the connection stack + QuickVoteControl.
   */
  compact?: boolean;
}

export function EngineColumn({pair, engineScore, onHighlight, compact = false}: EngineColumnProps) {
  const {cardA, cardB, connections} = pair;
  const connectionGroups = groupConnections(connections);
  const quickVote = useQuickVote(cardA.id, cardB.id, {
    cardAInk: cardA.ink,
    cardBInk: cardB.ink,
    engineScore,
    synergyCount: connections.length,
  });

  const connectionStack = connectionGroups.length > 0 ? (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.section}}>
      {connectionGroups.map((group) => (
        <ConnectionGroup
          key={group.key}
          group={group}
          cardA={cardA}
          cardB={cardB}
          onHighlight={onHighlight}
        />
      ))}
    </div>
  ) : null;

  const quickVoteEl = (
    <QuickVoteControl
      state={quickVote.state}
      onVote={quickVote.vote}
      distribution={quickVote.distribution}
      distributionLoading={quickVote.distributionLoading}
      userChoice={quickVote.userChoice}
      error={quickVote.error}
      engineScore={engineScore}
    />
  );

  if (compact) {
    // Mobile path — no ColumnHeader (tab pill replaces it), no outer panel wrapper (parent
    // controls spacing). Returns the connection stack + quick vote as direct flex children
    // of the parent panel; the parent's `gap` controls vertical rhythm between them.
    return (
      <>
        {connectionStack}
        {quickVoteEl}
      </>
    );
  }

  const ruleCount = connectionGroups.length;
  const ruleLabel = `${ruleCount} ${ruleCount === 1 ? 'rule' : 'rules'} contributing`;

  return (
    <section
      aria-label="Engine score"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.section,
        padding: '16px 18px',
        border: `1px solid ${GOLD_GLOW.hoverBorder}`,
        background: GOLD_GLOW.hoverBg,
        borderRadius: 12,
        fontFamily: FONTS.body,
      }}>
      <ColumnHeader
        title="Engine"
        accentColor={ENGINE_TINT}
        score={String(engineScore)}
        scoreColor={ENGINE_TINT}
        scoreFontSize={48}
        showScale
        scoreTooltip={'Perfect — 9.5 and up\nStrong — 7 to 9.4\nModerate — 4 to 6.9\nWeak — under 4'}
        // Key the score span by the pair ID so switching pairs re-mounts the span and re-fires
        // the connector-lands pulse (#332 #6 idea G). Without the key the animation would only
        // play on the initial mount — subsequent pair switches (clicking another partner from
        // within comparison view) would silently skip the pulse.
        pulseScoreKey={`${cardA.id}-${cardB.id}`}
        meta={
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: ENGINE_TINT,
                boxShadow: SHADOWS.glowSm,
              }}
            />
            {ruleLabel}
          </span>
        }
      />
      {connectionStack && (
        // marginBottom adds breathing room between the last ability row and the QuickVoteControl
        // below — the EngineColumn's outer gap (SPACING.section) wasn't enough on its own.
        <div style={{marginBottom: SPACING.section}}>{connectionStack}</div>
      )}
      {quickVoteEl}
    </section>
  );
}
