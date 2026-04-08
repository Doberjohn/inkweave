import {Fragment, useState} from 'react';
import type {LorcanaCard} from '../../features/cards';
import type {PairSynergyConnection, LocationRole} from 'inkweave-synergy-engine';
import {
  getPlaystyleById,
  LOCATION_ROLE_CHIP_LABELS,
  LOCATION_ROLE_DESCRIPTIONS,
} from 'inkweave-synergy-engine';
import {getStrengthTier} from '../../features/synergies/utils';
import {COLORS, FONT_SIZES, SPACING, RADIUS} from '../constants';
import {StrengthBadge} from './StrengthBadge';

// --- Types ---

export interface ConnectionGroupData {
  key: string;
  label: string;
  score: number;
  connections: PairSynergyConnection[];
  category: 'direct' | 'playstyle';
}

interface ConnectionGroupProps {
  group: ConnectionGroupData;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  showScoreBadge?: boolean;
  onHighlight?: (card: 'a' | 'b' | null) => void;
}

// --- Grouping utility ---

/** Group connections: playstyle rules merge by playstyleId, direct rules stay individual */
export function groupConnections(connections: PairSynergyConnection[]): ConnectionGroupData[] {
  const playstyleGroups = new Map<string, PairSynergyConnection[]>();
  const result: ConnectionGroupData[] = [];

  for (const conn of connections) {
    if (conn.category === 'playstyle') {
      const existing = playstyleGroups.get(conn.playstyleId);
      if (existing) {
        existing.push(conn);
      } else {
        playstyleGroups.set(conn.playstyleId, [conn]);
      }
    } else {
      result.push({
        key: conn.ruleId,
        label: conn.ruleName,
        score: conn.score,
        connections: [conn],
        category: 'direct',
      });
    }
  }

  for (const [playstyleId, conns] of playstyleGroups) {
    const playstyle = getPlaystyleById(playstyleId);
    const maxScore = Math.max(...conns.map((c) => c.score));
    result.push({
      key: playstyleId,
      label: playstyle?.name ?? playstyleId,
      score: maxScore,
      connections: conns,
      category: 'playstyle',
    });
  }

  return result.sort((a, b) => b.score - a.score);
}

// --- Internal helpers ---

function extractLocationRole(ruleId: string): LocationRole | null {
  const prefix = 'location-';
  if (!ruleId.startsWith(prefix)) return null;
  const candidate = ruleId.slice(prefix.length);
  if (candidate in LOCATION_ROLE_CHIP_LABELS) return candidate as LocationRole;
  return null;
}

function getRoleSourceName(
  conn: PairSynergyConnection,
  cardA: LorcanaCard,
  cardB: LorcanaCard,
): string {
  const nameOf = (card: LorcanaCard) => (cardA.name === cardB.name ? card.fullName : card.name);
  if (cardA.type === 'Location' && cardB.type !== 'Location') return nameOf(cardB);
  if (cardB.type === 'Location' && cardA.type !== 'Location') return nameOf(cardA);
  if (conn.explanation.startsWith(cardA.name)) return nameOf(cardA);
  if (conn.explanation.startsWith(cardB.name)) return nameOf(cardB);
  return nameOf(cardA);
}

function getLocationName(cardA: LorcanaCard, cardB: LorcanaCard): string {
  const nameOf = (card: LorcanaCard) => (cardA.name === cardB.name ? card.fullName : card.name);
  if (cardA.type === 'Location') return nameOf(cardA);
  if (cardB.type === 'Location') return nameOf(cardB);
  return 'locations';
}

function findCardInText(text: string, fullName: string): {index: number; match: string} {
  if (!fullName) return {index: -1, match: ''};
  const idx = text.indexOf(fullName);
  if (idx >= 0) return {index: idx, match: fullName};
  const dashIdx = fullName.indexOf(' - ');
  if (dashIdx > 0) {
    const baseName = fullName.slice(0, dashIdx);
    const baseIdx = text.indexOf(baseName);
    if (baseIdx >= 0) return {index: baseIdx, match: baseName};
  }
  return {index: -1, match: ''};
}

// --- Subcomponents ---

function ExplanationWithHighlights({
  text,
  cardAName,
  cardBName,
  onHighlight,
}: {
  text: string;
  cardAName: string;
  cardBName: string;
  onHighlight?: (card: 'a' | 'b' | null) => void;
}) {
  const segments: {text: string; card: 'a' | 'b' | null}[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const hitA = findCardInText(remaining, cardAName);
    const hitB = findCardInText(remaining, cardBName);

    let matchIdx = -1;
    let matchName = '';
    let matchCard: 'a' | 'b' = 'a';

    if (hitA.index >= 0 && hitB.index >= 0 && hitA.index === hitB.index) {
      // Same position — prefer the longer match to avoid partial name splits
      if (hitA.match.length >= hitB.match.length) {
        matchIdx = hitA.index; matchName = hitA.match; matchCard = 'a';
      } else {
        matchIdx = hitB.index; matchName = hitB.match; matchCard = 'b';
      }
    } else if (hitA.index >= 0 && (hitB.index < 0 || hitA.index < hitB.index)) {
      matchIdx = hitA.index; matchName = hitA.match; matchCard = 'a';
    } else if (hitB.index >= 0) {
      matchIdx = hitB.index; matchName = hitB.match; matchCard = 'b';
    }

    if (matchIdx < 0) {
      segments.push({text: remaining, card: null});
      break;
    }

    if (matchIdx > 0) segments.push({text: remaining.slice(0, matchIdx), card: null});
    segments.push({text: matchName, card: matchCard});
    remaining = remaining.slice(matchIdx + matchName.length);
  }

  return (
    <span style={{fontSize: `${FONT_SIZES.base}px`, lineHeight: 1.4, color: COLORS.descriptionText}}>
      {segments.map((seg, i) =>
        seg.card && onHighlight ? (
          <span
            key={i}
            onMouseEnter={() => onHighlight(seg.card)}
            onMouseLeave={() => onHighlight(null)}
            style={{
              color: COLORS.primary500,
              borderBottom: '1px dashed rgba(212, 175, 55, 0.4)',
              cursor: 'default',
              transition: 'border-color 0.2s ease',
            }}>
            {seg.text}
          </span>
        ) : seg.card ? (
          <span key={i} style={{color: COLORS.primary500}}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

// --- Main component ---

export function ConnectionGroup({
  group,
  cardA,
  cardB,
  showScoreBadge = true,
  onHighlight,
}: ConnectionGroupProps) {
  const [expanded, setExpanded] = useState(true);
  const [hovered, setHovered] = useState(false);
  const tier = getStrengthTier(group.score);
  const hasMultipleRoles = group.connections.length > 1;

  return (
    <div
      style={{
        background: COLORS.surface,
        borderRadius: `${RADIUS.md}px`,
        border: `1px solid ${expanded ? 'rgba(212, 175, 55, 0.2)' : COLORS.surfaceBorder}`,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${SPACING.sm}px`,
          width: '100%',
          padding: '10px 12px',
          background: hovered ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
        }}>
        {showScoreBadge && (
          <StrengthBadge tier={tier} size="lg">
            {group.score}
          </StrengthBadge>
        )}
        <span
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
            color: COLORS.text,
          }}>
          {group.label}
        </span>
        {hasMultipleRoles && (
          <span
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              fontWeight: 500,
              color: COLORS.textMuted,
            }}>
            {group.connections.length} roles
          </span>
        )}
        <span
          style={{
            marginLeft: 'auto',
            fontSize: `${FONT_SIZES.base}px`,
            color: expanded ? COLORS.primary : COLORS.textMuted,
            transition: 'color 0.15s, transform 0.15s',
            transform: expanded ? 'rotate(90deg)' : 'none',
            lineHeight: 1,
          }}>
          ▸
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${COLORS.surfaceBorder}`,
            padding: '10px 12px 12px',
            display: 'grid',
            gridTemplateColumns: hasMultipleRoles ? 'auto 1fr' : '1fr',
            gap: `${SPACING.sm}px`,
            alignItems: 'start',
          }}>
          {group.connections.map((conn, i) => {
            const role = extractLocationRole(conn.ruleId);
            const chipLabel = role ? LOCATION_ROLE_CHIP_LABELS[role] : null;
            const description = role
              ? LOCATION_ROLE_DESCRIPTIONS[role](getRoleSourceName(conn, cardA, cardB), getLocationName(cardA, cardB))
              : conn.explanation;
            const divider = i > 0 && (
              <div
                key={`${conn.ruleId}-divider`}
                style={{
                  gridColumn: '1 / -1',
                  height: 1,
                  background: 'rgba(212, 175, 55, 0.15)',
                }}
              />
            );

            return hasMultipleRoles ? (
              <Fragment key={conn.ruleId}>
                {divider}
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 8,
                    background: chipLabel ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                    color: COLORS.primary,
                    fontSize: `${FONT_SIZES.xs}px`,
                    fontWeight: 600,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    marginTop: 1,
                  }}>
                  {chipLabel ?? ''}
                </span>
                <ExplanationWithHighlights
                  text={description}
                  cardAName={cardA.fullName}
                  cardBName={cardB.fullName}
                  onHighlight={onHighlight}
                />
              </Fragment>
            ) : (
              <Fragment key={conn.ruleId}>
                {divider}
                <ExplanationWithHighlights
                  text={description}
                  cardAName={cardA.fullName}
                  cardBName={cardB.fullName}
                  onHighlight={onHighlight}
                />
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
