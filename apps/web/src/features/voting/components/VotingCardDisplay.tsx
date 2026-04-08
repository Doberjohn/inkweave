import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardImage, CardLightbox} from '../../../shared/components';
import {COLORS, FONTS, FONT_SIZES} from '../../../shared/constants';

interface VotingCardDisplayProps {
  card: LorcanaCard;
  isMobile?: boolean;
  highlighted?: boolean;
  dimmed?: boolean;
}

const CARD_ASPECT = 337 / 470;

/** Extract base name and version from "Name - Version" format */
function splitCardName(fullName: string): {name: string; version: string | null} {
  const dashIdx = fullName.indexOf(' - ');
  if (dashIdx < 0) return {name: fullName, version: null};
  return {name: fullName.slice(0, dashIdx), version: fullName.slice(dashIdx + 3)};
}

/** Renders a CardImage rotated 90° for landscape location cards */
function RotatedCardImage({card, containerWidth, borderRadius}: {card: LorcanaCard; containerWidth: number; borderRadius: number}) {
  // Container is landscape: containerWidth × landscapeHeight
  const landscapeHeight = Math.round(containerWidth * CARD_ASPECT);
  // CardImage rendered at swapped portrait dims: landscapeHeight × containerWidth
  // After 90° rotation, it visually fills containerWidth × landscapeHeight exactly
  return (
    <div style={{
      width: containerWidth,
      height: landscapeHeight,
      position: 'relative',
      overflow: 'hidden',
      borderRadius,
    }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(90deg)',
      }}>
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={landscapeHeight}
          height={containerWidth}
          inkColor={card.ink}
          cost={card.cost}
          borderRadius={0}
        />
      </div>
    </div>
  );
}

export function VotingCardDisplay({card, isMobile, highlighted, dimmed}: VotingCardDisplayProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isLocation = card.type === 'Location';
  const imageWidth = isMobile ? 130 : 340;
  const imageHeight = Math.round(imageWidth / CARD_ASPECT);
  const displayHeight = isLocation ? Math.round(imageWidth * CARD_ASPECT) : imageHeight;

  if (isMobile) {
    const {name, version} = splitCardName(card.fullName);
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          flex: 1,
          minWidth: 0,
          opacity: dimmed ? 0.4 : 1,
          transition: 'opacity 0.2s ease',
        }}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- mobile-only tap-to-enlarge */}
        <div
          onClick={card.imageUrl ? () => setLightboxOpen(true) : undefined}
          style={{
            boxShadow: highlighted ? '0 0 16px 2px rgba(212, 175, 55, 0.45)' : 'none',
            transition: 'box-shadow 0.2s ease',
            borderRadius: 8,
          }}>
          {isLocation ? (
            <RotatedCardImage card={card} containerWidth={imageWidth} borderRadius={8} />
          ) : (
            <CardImage
              src={card.imageUrl}
              alt={card.fullName}
              width={imageWidth}
              height={imageHeight}
              inkColor={card.ink}
              cost={card.cost}
              borderRadius={8}
              style={{maxWidth: '100%', height: 'auto', flexShrink: 1}}
            />
          )}
        </div>
        <div style={{minHeight: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
          <span style={{fontSize: FONT_SIZES.base, fontWeight: 500, color: COLORS.text, fontFamily: FONTS.body, textAlign: 'center'}}>
            {name}
          </span>
          {version && (
            <span style={{fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontFamily: FONTS.body, textAlign: 'center', marginTop: 2}}>
              {version}
            </span>
          )}
        </div>
        {lightboxOpen && card.imageUrl && (
          <CardLightbox
            src={card.imageUrl}
            alt={card.fullName}
            isLocation={card.type === 'Location'}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: imageWidth,
        height: displayHeight,
        flexShrink: 0,
        boxSizing: 'border-box',
        borderRadius: 12,
        boxShadow: highlighted ? '0 0 16px 2px rgba(212, 175, 55, 0.45)' : 'none',
        opacity: dimmed ? 0.4 : 1,
        transition: 'box-shadow 0.2s ease, opacity 0.2s ease',
      }}>
      {isLocation ? (
        <RotatedCardImage card={card} containerWidth={imageWidth} borderRadius={12} />
      ) : (
        <CardImage
          src={card.imageUrl}
          alt={card.fullName}
          width={imageWidth}
          height={imageHeight}
          inkColor={card.ink}
          cost={card.cost}
          borderRadius={12}
        />
      )}
    </div>
  );
}
