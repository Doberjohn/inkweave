import {CardImage} from '../../../shared/components';
import type {PairPreview} from '../hooks/usePairQueue';

interface PairStackProps {
  pairs: PairPreview[];
  side: 'left' | 'right';
}

const STACK_CONFIG = [
  {scale: 0.55, tilt: 3, opacity: 0.55},
  {scale: 0.4, tilt: 7, opacity: 0.3},
  {scale: 0.28, tilt: 11, opacity: 0.15},
];

const CARD_WIDTH = 240;
const CARD_HEIGHT = 335;
const CARD_GAP = 40;

export function PairStack({pairs, side}: PairStackProps) {
  if (pairs.length === 0) return null;

  const isLeft = side === 'left';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isLeft ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: 48,
        pointerEvents: 'none',
        flexShrink: 0,
      }}>
      {pairs.map((pair, i) => {
        const config = STACK_CONFIG[i];
        if (!config) return null;
        const tilt = isLeft ? -config.tilt : config.tilt;
        const w = Math.round(CARD_WIDTH * config.scale);
        const h = Math.round(CARD_HEIGHT * config.scale);
        const gap = Math.round(CARD_GAP * config.scale);

        return (
          <div
            key={`${pair.cardA.id}-${pair.cardB.id}`}
            style={{
              display: 'flex',
              gap,
              transform: `rotate(${tilt}deg)`,
              opacity: config.opacity,
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}>
            <CardImage
              src={pair.cardA.imageUrl}
              alt={pair.cardA.fullName}
              width={w}
              height={h}
              inkColor={pair.cardA.ink}
              cost={pair.cardA.cost}
              borderRadius={8}
            />
            <CardImage
              src={pair.cardB.imageUrl}
              alt={pair.cardB.fullName}
              width={w}
              height={h}
              inkColor={pair.cardB.ink}
              cost={pair.cardB.cost}
              borderRadius={8}
            />
          </div>
        );
      })}
    </div>
  );
}
