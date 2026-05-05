import {useNavigate} from 'react-router-dom';
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
  const navigate = useNavigate();
  const quickVote = useQuickVote(cardA.id, cardB.id);

  const ruleCount = connectionGroups.length;
  const ruleLabel = `${ruleCount} ${ruleCount === 1 ? 'rule' : 'rules'} contributing`;

  return (
    <section
      aria-label="Engine score"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
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
        <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
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
        distributionFailed={quickVote.distributionFailed}
        userChoice={quickVote.userChoice}
        error={quickVote.error}
        onRateInDetail={() => navigate(`/vote/${cardA.id}/${cardB.id}`)}
      />
    </section>
  );
}
