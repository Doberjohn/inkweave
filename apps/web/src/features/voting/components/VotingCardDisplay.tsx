import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardImage, CardLightbox} from '../../../shared/components';
import {COLORS, FONTS, FONT_SIZES} from '../../../shared/constants';

interface VotingCardDisplayProps {
  card: LorcanaCard;
  isMobile?: boolean;
  highlighted?: boolean;
}

const CARD_ASPECT = 337 / 470;

/** Extract base name and version from "Name - Version" format */
function splitCardName(fullName: string): {name: string; version: string | null} {
  const dashIdx = fullName.indexOf(' - ');
  if (dashIdx < 0) return {name: fullName, version: null};
  return {name: fullName.slice(0, dashIdx), version: fullName.slice(dashIdx + 3)};
}

export function VotingCardDisplay({card, isMobile, highlighted}: VotingCardDisplayProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const imageWidth = isMobile ? 130 : 340;
  const imageHeight = Math.round(imageWidth / CARD_ASPECT);

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
        }}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- mobile-only tap-to-enlarge */}
        <div
          onClick={card.imageUrl ? () => setLightboxOpen(true) : undefined}
          style={{
            borderRadius: 8,
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: highlighted ? '0 0 16px 2px rgba(212, 175, 55, 0.45)' : 'none',
            transition: 'box-shadow 0.2s ease',
          }}>
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
        boxSizing: 'border-box',
        borderRadius: 12,
        display: 'flex',
        boxShadow: highlighted ? '0 0 16px 2px rgba(212, 175, 55, 0.45)' : 'none',
        transition: 'box-shadow 0.2s ease',
      }}>
      <CardImage
        src={card.imageUrl}
        alt={card.fullName}
        width={imageWidth}
        height={imageHeight}
        inkColor={card.ink}
        cost={card.cost}
        borderRadius={12}
      />
    </div>
  );
}
