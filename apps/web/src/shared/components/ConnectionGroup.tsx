import type {LorcanaCard} from '../../features/cards';
import type {LocationRole, PairSynergyConnection} from 'inkweave-synergy-engine';
import {LOCATION_ROLE_CHIP_LABELS, LOCATION_ROLE_DESCRIPTIONS} from 'inkweave-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING} from '../constants';
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

type ExplanationSegment =
  | {kind: 'text'; text: string}
  | {kind: 'name'; text: string; card: 'a' | 'b'}
  | {kind: 'token'; card: 'a' | 'b'};

/**
 * Tokenize an explanation string into renderable segments. Detects:
 * - `{A}` / `{B}` chip tokens (engine emits these for role-aware references)
 * - Card-name occurrences (legacy path, preserved for any explanations that still embed names)
 *
 * Chip tokens always win over a card-name match at the same index since they are
 * length-3 sentinels emitted by the engine specifically for this purpose.
 */
function tokenizeExplanation(
  text: string,
  cardAName: string,
  cardBName: string,
): ExplanationSegment[] {
  const segments: ExplanationSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const tokenA = remaining.indexOf('{A}');
    const tokenB = remaining.indexOf('{B}');
    const nameA = findCardInText(remaining, cardAName);
    const nameB = findCardInText(remaining, cardBName);

    type Candidate =
      | {kind: 'token'; idx: number; length: number; card: 'a' | 'b'}
      | {kind: 'name'; idx: number; length: number; card: 'a' | 'b'; match: string};
    const candidates: Candidate[] = [];
    if (tokenA >= 0) candidates.push({kind: 'token', idx: tokenA, length: 3, card: 'a'});
    if (tokenB >= 0) candidates.push({kind: 'token', idx: tokenB, length: 3, card: 'b'});
    if (nameA.index >= 0) candidates.push({kind: 'name', idx: nameA.index, length: nameA.match.length, card: 'a', match: nameA.match});
    if (nameB.index >= 0) candidates.push({kind: 'name', idx: nameB.index, length: nameB.match.length, card: 'b', match: nameB.match});

    if (candidates.length === 0) {
      segments.push({kind: 'text', text: remaining});
      break;
    }

    // Earliest index wins; tie-break on longer match (prefer full names over partials)
    candidates.sort((x, y) => (x.idx - y.idx) || (y.length - x.length));
    const winner = candidates[0];

    if (winner.idx > 0) segments.push({kind: 'text', text: remaining.slice(0, winner.idx)});
    if (winner.kind === 'token') {
      segments.push({kind: 'token', card: winner.card});
    } else {
      segments.push({kind: 'name', text: winner.match, card: winner.card});
    }
    remaining = remaining.slice(winner.idx + winner.length);
  }

  return segments;
}

function ExplanationWithHighlights({
  text,
  cardA,
  cardB,
  onHighlight,
}: {
  text: string;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  onHighlight?: (card: 'a' | 'b' | null) => void;
}) {
  const segments = tokenizeExplanation(text, cardA.fullName, cardB.fullName);
  // Each chip's color matches the corresponding card's ink. Dual-ink cards take
  // their primary ink (card.ink); secondary ink (card.ink2) is intentionally
  // ignored for now — keeping the chip palette to one swatch keeps the visual
  // hierarchy simple.
  const inkA = INK_COLORS[cardA.ink];
  const inkB = INK_COLORS[cardB.ink];

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return <span key={i}>{seg.text}</span>;
        }
        if (seg.kind === 'token') {
          const ink = seg.card === 'a' ? inkA : inkB;
          // Chip-styled inline pill, tinted to the corresponding card's ink color.
          // Dark `bg` + vibrant `text` from INK_COLORS keeps the chip on-theme
          // for the dark fantasy palette while signaling which card the token
          // refers to without requiring a hover.
          return (
            <span
              key={i}
              onMouseEnter={onHighlight ? () => onHighlight(seg.card) : undefined}
              onMouseLeave={onHighlight ? () => onHighlight(null) : undefined}
              style={{
                display: 'inline-block',
                background: ink.bg,
                color: ink.text,
                border: `1px solid ${ink.border}`,
                fontWeight: 700,
                fontSize: 11,
                lineHeight: 1,
                padding: '2px 6px',
                borderRadius: 3,
                textAlign: 'center',
                verticalAlign: 'baseline',
                cursor: onHighlight ? 'default' : 'inherit',
                userSelect: 'none',
              }}>
              {seg.card.toUpperCase()}
            </span>
          );
        }
        // seg.kind === 'name' — legacy card-name highlight path (still styled the dashed-underline way)
        return onHighlight ? (
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
        ) : (
          <span key={i} style={{color: COLORS.lorcanaCardLink, fontWeight: 700}}>
            {seg.text}
          </span>
        );
      })}
    </span>
  );
}

// Description's line-height multiplier. Sized so one description line (13 × 1.7
// = 22.1px) is comfortably taller than the inline-block label (font 12 + padding
// 4+4 = 20px). When label height ≤ description line height, line 1's line-box
// doesn't grow beyond a normal description line and wrapped lines (2+) follow
// the standard description rhythm.
const DESCRIPTION_LINE_HEIGHT = 1.7;

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
    // start of the text flow. Line 1 (label + start of description) sits flush against the
    // container's left border via text-indent; wrapped lines (line 2+) are governed by
    // padding-left so they have breathing room from the border instead of touching it.
    <div
      style={{
        background: COLORS.lorcanaCream,
        borderRadius: `${RADIUS.sm}px`,
        padding: '8px 12px',
        // textIndent pulls only line 1 back by `padding-left` so the label hugs
        // the container's left edge while wrapped lines stay indented at content-left.
        textIndent: -12,
        overflow: 'hidden',
        boxShadow: ABILITY_BOX_SHADOW,
        color: COLORS.lorcanaTextDark,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 600,
        lineHeight: DESCRIPTION_LINE_HEIGHT,
      }}>
      <span
        style={{
          // inline-block keeps the label in the inline flow (so text-indent pulls
          // it back to the container's left edge) while still giving us a proper
          // block-level box model for vertical padding.
          display: 'inline-block',
          verticalAlign: 'middle',
          // Reset text-indent so the parent's negative text-indent doesn't cascade
          // into the label's own inline text and clip the first letter against the
          // container's overflow:hidden edge. text-indent is an inherited property —
          // the label has its own block-formatting context but still inherits the value.
          textIndent: 0,
          marginRight: 8,
          padding: '4px 8px',
          background: COLORS.lorcanaTagBg,
          color: COLORS.lorcanaTagText,
          fontFamily: FONTS.body,
          fontWeight: 700,
          fontSize: `${FONT_SIZES.md}px`,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          lineHeight: `${FONT_SIZES.md}px`,
          borderRadius: `${RADIUS.xs}px`,
        }}>
        {label}
      </span>
      <ExplanationWithHighlights
        text={description}
        cardA={cardA}
        cardB={cardB}
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
