import {useState} from 'react';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {SynergyGroup} from './SynergyGroup';
import {COLORS, FONT_SIZES, FONTS, RADIUS, SPACING} from '../../../shared/constants';

interface ExpandedGroupViewProps {
  group: SynergyGroupData;
  isMobile?: boolean;
  onBackToAll: () => void;
}

/** Shared expanded view for a single synergy group — back link, title, description, full card grid. */
export function ExpandedGroupView({group, isMobile = false, onBackToAll}: ExpandedGroupViewProps) {
  const [backHovered, setBackHovered] = useState(false);

  return (
    <div>
      {/* Back navigation */}
      <button
        onClick={onBackToAll}
        onMouseEnter={() => setBackHovered(true)}
        onMouseLeave={() => setBackHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: backHovered ? COLORS.primary500 : COLORS.textMuted,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 500,
          padding: 0,
          marginBottom: `${SPACING.lg}px`,
          transition: 'color 0.15s',
        }}>
        <span style={{fontSize: `${FONT_SIZES.base}px`}}>&larr;</span>
        Back to all synergies
      </button>

      {/* Group title */}
      <h2
        style={{
          fontSize: `${FONT_SIZES.xl}px`,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          margin: 0,
          marginBottom: `${SPACING.sm}px`,
          color: COLORS.text,
        }}>
        {group.label}
      </h2>

      {/* Description callout */}
      <div
        style={{
          margin: `${SPACING.sm}px 0 ${SPACING.lg}px`,
          padding: `${SPACING.sm}px ${SPACING.md}px`,
          background: COLORS.calloutBg,
          borderLeft: `3px solid ${COLORS.primary}`,
          borderRadius: `0 ${RADIUS.sm}px ${RADIUS.sm}px 0`,
        }}>
        <p
          style={{
            margin: 0,
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.descriptionText,
            lineHeight: 1.5,
          }}>
          {group.description}
        </p>
      </div>

      {/* Full card grid — no truncation */}
      <SynergyGroup
        group={group}
        isMobile={isMobile}
        maxVisibleCards={Infinity}
        showHeader={false}
        cardMinWidth={180}
      />
    </div>
  );
}
