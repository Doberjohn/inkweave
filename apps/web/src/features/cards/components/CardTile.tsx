import {motion} from 'framer-motion';
import type {LorcanaCard} from '../types';
import {INK_COLORS, COLORS, FONT_SIZES, RADIUS, LAYOUT} from '../../../shared/constants';
import {CardImage} from '../../../shared/components';
import {useCardPreviewHandlers} from './useCardPreviewHandlers';

interface CardTileProps {
  card: LorcanaCard;
  onClick: () => void;
  isSelected: boolean;
}

export function CardTile({card, onClick, isSelected}: CardTileProps) {
  const colors = INK_COLORS[card.ink];
  const {previewHandlers} = useCardPreviewHandlers({card, onTap: onClick});

  return (
    <motion.button
      onClick={onClick}
      {...previewHandlers}
      aria-pressed={isSelected}
      whileHover={{scale: 1.02, y: -2}}
      whileTap={{scale: 0.98}}
      transition={{type: 'spring', stiffness: 400, damping: 25}}
      style={{
        display: 'flex',
        gap: '12px',
        padding: '10px',
        borderRadius: `${RADIUS.lg}px`,
        border: `2px solid ${isSelected ? colors.border : 'transparent'}`,
        background: isSelected ? colors.bg : COLORS.white,
        boxShadow: isSelected ? `0 0 0 2px ${colors.border}40` : '0 1px 3px rgba(0,0,0,0.1)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        alignItems: 'center',
      }}>
      <CardImage
        src={card.imageUrl}
        alt=""
        width={LAYOUT.cardTileImageWidth}
        height={LAYOUT.cardTileImageHeight}
        inkColor={card.ink}
        cost={card.cost}
        lazy={true}
        borderRadius={RADIUS.sm}
      />
      <div style={{flex: 1, minWidth: 0}}>
        <span
          style={{
            fontWeight: 600,
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.gray800,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
          }}>
          {card.name}
        </span>
        {card.version && (
          <span
            style={{
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.gray500,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
            {card.version}
          </span>
        )}
        <div style={{display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap'}}>
          {card.keywords?.slice(0, 2).map((k) => (
            <span
              key={k}
              style={{
                fontSize: `${FONT_SIZES.xs}px`,
                background: COLORS.gray100,
                color: COLORS.gray700,
                padding: '1px 4px',
                borderRadius: '3px',
              }}>
              {k.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>

    </motion.button>
  );
}
