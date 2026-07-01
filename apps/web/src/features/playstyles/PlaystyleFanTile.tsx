import {useRef, type CSSProperties} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {smallImageUrl} from '../cards';
import {useContainerWidth} from '../../shared/hooks';
import {COLORS, FONTS, FONT_SIZES} from '../../shared/constants';
import './playstyles.css';

/** The inner width the fan geometry is authored for; the tile scales to fill its column. */
const DESIGN_WIDTH = 300;
const FAN_HEIGHT = 118;

type Slot = {w: number; h: number; ml: number; z: number; t: string; th: string};
/** Five slots, hero at index 2. Base (--t) and hover (--th) transforms. */
const FAN_GEO: readonly Slot[] = [
  {w: 56, h: 78, ml: -28, z: 1, t: 'translateX(-118px) rotate(-14deg)', th: 'translateX(-130px) rotate(-19deg)'},
  {w: 64, h: 90, ml: -32, z: 2, t: 'translateX(-60px) rotate(-7deg)', th: 'translateX(-66px) translateY(-4px) rotate(-10deg)'},
  {w: 72, h: 101, ml: -36, z: 5, t: 'translateX(0px) rotate(0deg)', th: 'translateY(-8px)'},
  {w: 64, h: 90, ml: -32, z: 2, t: 'translateX(60px) rotate(7deg)', th: 'translateX(66px) translateY(-4px) rotate(10deg)'},
  {w: 56, h: 78, ml: -28, z: 1, t: 'translateX(118px) rotate(14deg)', th: 'translateX(130px) rotate(19deg)'},
];

export type FanCardData = Pick<LorcanaCard, 'id' | 'imageUrl' | 'imageHashSm' | 'fullName'> | undefined;

export interface PlaystyleFanTileProps {
  playstyleId: string;
  name: string;
  accentColor: string;
  accentRgb: string;
  cardCount: number;
  heroCard: FanCardData;
  /** Up to four supporting cards; fewer renders empty card backs. */
  supportCards: FanCardData[];
  onNavigate?: (id: string) => void;
}

export function PlaystyleFanTile({
  playstyleId,
  name,
  accentColor,
  accentRgb,
  cardCount,
  heroCard,
  supportCards,
  onNavigate,
}: PlaystyleFanTileProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(innerRef);
  const scale = width > 0 ? width / DESIGN_WIDTH : 1;

  // Arrange around the hero: [support0, support1, HERO, support2, support3].
  const arranged: FanCardData[] = [supportCards[0], supportCards[1], heroCard, supportCards[2], supportCards[3]];

  const wash = `linear-gradient(150deg, rgba(${accentRgb}, 0.20), rgba(${accentRgb}, 0.05) 60%, transparent), #0b0b12`;

  return (
    <a
      href={`/playstyles/${playstyleId}`}
      className="playstyle-fan-tile"
      aria-label={`${name}: ${cardCount} cards`}
      onClick={(e) => {
        if (onNavigate) {
          e.preventDefault();
          onNavigate(playstyleId);
        }
      }}
      style={
        {
          '--accent-rgb': accentRgb,
          borderRadius: 14,
          border: `1px solid rgba(${accentRgb}, 0.4)`,
          background: wash,
          padding: 14,
        } as CSSProperties
      }>
      <div ref={innerRef} style={{position: 'relative', height: Math.round(FAN_HEIGHT * scale), marginBottom: 10}}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            width: DESIGN_WIDTH,
            height: FAN_HEIGHT,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: 'top center',
          }}>
          {FAN_GEO.map((g, i) => {
            const card = arranged[i];
            return (
              <div
                key={i}
                className="playstyle-fan-card"
                style={
                  {
                    position: 'absolute',
                    left: '50%',
                    top: 10,
                    width: g.w,
                    height: g.h,
                    marginLeft: g.ml,
                    zIndex: g.z,
                    '--t': g.t,
                    '--th': g.th,
                    borderRadius: 7,
                    overflow: 'hidden',
                    border: i === 2 ? `1px solid rgba(${accentRgb}, 0.6)` : `1px solid rgba(${accentRgb}, 0.35)`,
                    boxShadow: '0 10px 22px rgba(0, 0, 0, 0.55)',
                    background: '#0c0c15',
                  } as CSSProperties
                }>
                {card?.imageUrl && (
                  <img
                    src={smallImageUrl(card)}
                    alt={card.fullName}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
        <span style={{width: 9, height: 9, borderRadius: '50%', background: accentColor, flexShrink: 0}} />
        <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xl}px`, fontWeight: 600, color: COLORS.text}}>{name}</span>
        <span style={{marginLeft: 'auto', fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted}}>{cardCount} cards</span>
      </div>
    </a>
  );
}
