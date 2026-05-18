import type {DetailedPairSynergy} from 'inkweave-synergy-engine';
import {ColumnHeader} from './ColumnHeader';
import {ConnectionGroup, groupConnections} from '../../../shared/components';
import {QuickVoteControl} from '../../voting/components';
import {useQuickVote} from '../../voting/hooks';
import {COLORS, FONTS, SPACING, hexRgba} from '../../../shared/constants';

const ENGINE_TINT = COLORS.primary500;

interface EngineColumnProps {
  pair: DetailedPairSynergy;
  engineScore: number;
  onHighlight?: (id: 'a' | 'b' | null) => void;
}

export function EngineColumn({pair, engineScore, onHighlight}: EngineColumnProps) {
  const {cardA, cardB, connections} = pair;
  const connectionGroups = groupConnections(connections);
  const quickVote = useQuickVote(cardA.id, cardB.id);

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
        border: `1px solid ${hexRgba(ENGINE_TINT, 0.25)}`,
        background: hexRgba(ENGINE_TINT, 0.04),
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
        meta={
          <span style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: ENGINE_TINT,
                boxShadow: `0 0 6px ${hexRgba(ENGINE_TINT, 0.6)}`,
              }}
            />
            {ruleLabel}
          </span>
        }
      />
      {connectionGroups.length > 0 && (
        // marginBottom adds breathing room between the last ability row and the QuickVoteControl
        // below — the EngineColumn's outer gap (SPACING.section) wasn't enough on its own.
        <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.section, marginBottom: SPACING.section}}>
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
      )}
      <QuickVoteControl
        state={quickVote.state}
        onVote={quickVote.vote}
        distribution={quickVote.distribution}
        distributionLoading={quickVote.distributionLoading}
        userChoice={quickVote.userChoice}
        error={quickVote.error}
        engineScore={engineScore}
      />
    </section>
  );
}
