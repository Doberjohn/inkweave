import type {LorcanaCard} from '../../features/cards';
import type {LocationRole, PairSynergyConnection} from 'inkweave-synergy-engine';
import {LOCATION_ROLE_CHIP_LABELS, LOCATION_ROLE_DESCRIPTIONS} from 'inkweave-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../constants';
import type {ConnectionGroupData} from './groupConnections';

interface ConnectionGroupProps {
  group: ConnectionGroupData;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  onHighlight?: (card: 'a' | 'b' | null) => void;
}

const ABILITY_BOX_SHADOW =
  '0 3px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(0, 0, 0, 0.18)';

// ── Internal helpers ──

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

// ── Subcomponents ──

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
      // Same position; prefer the longer match to avoid partial name splits
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
    <span>
      {segments.map((seg, i) =>
        seg.card && onHighlight ? (
          <span
            key={i}
            onMouseEnter={() => onHighlight(seg.card)}
            onMouseLeave={() => onHighlight(null)}
            style={{
              color: COLORS.lorcanaCardLink,
              fontWeight: 700,
              borderBottom: '1px dashed rgba(122, 77, 24, 0.45)',
              cursor: 'default',
              transition: 'border-color 0.15s ease, color 0.15s ease',
            }}>
            {seg.text}
          </span>
        ) : seg.card ? (
          <span key={i} style={{color: COLORS.lorcanaCardLink, fontWeight: 700}}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

// Description's effective line height in pixels — used to size the inline
// label so it lands exactly on the first line's baseline.
const DESCRIPTION_LINE_HEIGHT_PX = FONT_SIZES.base * 1.4;

function AbilityRow({
  label,
  description,
  cardA,
  cardB,
  onHighlight,
}: {
  label: string;
  description: string;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  onHighlight?: (card: 'a' | 'b' | null) => void;
}) {
  return (
    // Lorcana ability-text layout: cream container with a small dark label inline at the
    // start of the text flow. The description wraps around the floated label on line 1
    // and continues at the full container width on subsequent lines (matches Lorcana's
    // ability-box typography). overflow: hidden contains the float.
    <div
      style={{
        background: COLORS.lorcanaCream,
        borderRadius: `${RADIUS.sm}px`,
        // padding-left is 0 so the label box touches the cream container's left
        // border AND wrapped description lines (line 2+) start at the same edge.
        padding: '8px 12px 8px 0',
        overflow: 'hidden',
        boxShadow: ABILITY_BOX_SHADOW,
        color: COLORS.lorcanaTextDark,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 600,
        lineHeight: 1.4,
      }}>
      <span
        style={{
          float: 'left',
          marginRight: 8,
          padding: '0 8px',
          background: COLORS.lorcanaTagBg,
          color: COLORS.lorcanaTagText,
          fontFamily: FONTS.body,
          fontWeight: 700,
          fontSize: `${FONT_SIZES.xs}px`,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          // Set slightly less than the description's line-height so the float reliably
          // clears after one line. CSS spec doesn't define wrap behavior at the boundary
          // (when float-bottom == line-2-top): browsers can land line 2 either past the
          // float or still next to it depending on subpixel rounding. Shaving 2px
          // guarantees line 2 wraps to the container's left edge.
          lineHeight: `${DESCRIPTION_LINE_HEIGHT_PX - 2}px`,
          borderRadius: `${RADIUS.xs}px`,
        }}>
        {label}
      </span>
      <ExplanationWithHighlights
        text={description}
        cardAName={cardA.fullName}
        cardBName={cardB.fullName}
        onHighlight={onHighlight}
      />
    </div>
  );
}

// ── Main component ──

/**
 * Lorcana ability-box row variant for a synergy rule (or a multi-role playstyle group).
 * Single-connection groups render as one ability box. Multi-role groups render as a stack
 * of one ability box per sub-role (e.g., Locations: At-payoff / Move / Buff).
 */
export function ConnectionGroup({group, cardA, cardB, onHighlight}: ConnectionGroupProps) {
  const hasMultipleRoles = group.connections.length > 1;

  if (hasMultipleRoles) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: `${SPACING.sm}px`}}>
        {group.connections.map((conn) => {
          const role = extractLocationRole(conn.ruleId);
          const subLabel = role ? LOCATION_ROLE_CHIP_LABELS[role] : conn.ruleName;
          const description = role
            ? LOCATION_ROLE_DESCRIPTIONS[role](
                getRoleSourceName(conn, cardA, cardB),
                getLocationName(cardA, cardB),
              )
            : conn.explanation;
          return (
            <AbilityRow
              key={conn.ruleId}
              label={subLabel}
              description={description}
              cardA={cardA}
              cardB={cardB}
              onHighlight={onHighlight}
            />
          );
        })}
      </div>
    );
  }

  const conn = group.connections[0];
  return (
    <AbilityRow
      label={group.label}
      description={conn.explanation}
      cardA={cardA}
      cardB={cardB}
      onHighlight={onHighlight}
    />
  );
}
