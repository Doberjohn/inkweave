import {useState, useEffect} from 'react';
import type {LorcanaCard} from '../../features/cards';
import type {Ink, LocationRole, PairSynergyConnection} from 'inkweave-synergy-engine';
import {LOCATION_ROLE_CHIP_LABELS, LOCATION_ROLE_DESCRIPTIONS} from 'inkweave-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, RADIUS} from '../constants';
import {useResponsive} from '../hooks';
import type {ConnectionGroupData} from './groupConnections';

// ── Chip palette ──
// Vibrant Lorcana brand ink colors used as the inline-chip background. Distinct from
// the darker INK_COLORS (which is tuned for card-badge use against dark surfaces);
// these are the ink-symbol colors the game uses on its physical cards. Text colors
// chosen per-ink for WCAG-readable contrast against each bg.
const CHIP_BG_BY_INK: Record<Ink, string> = {
  Amber: '#F5B202',
  Amethyst: '#81377B',
  Emerald: '#2A8934',
  Ruby: '#D3082F',
  Sapphire: '#0189C4',
  Steel: '#9FA8B4',
};

const CHIP_TEXT_BY_INK: Record<Ink, string> = {
  Amber: '#000000',
  Amethyst: '#FFFFFF',
  Emerald: '#FFFFFF',
  Ruby: '#FFFFFF',
  Sapphire: '#FFFFFF',
  Steel: '#000000',
};

interface ConnectionGroupProps {
  group: ConnectionGroupData;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  onHighlight?: (card: 'a' | 'b' | null) => void;
}

const ABILITY_BOX_SHADOW =
  '0 3px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(0, 0, 0, 0.18)';

/**
 * AbilityRow stacking position. Drives corner radii and box-shadow:
 * - 'solo':   single isolated row — full radius, full shadow (default; matches single-rule case)
 * - 'first':  top of a stack — top corners rounded, bottom flat, no shadow
 * - 'middle': middle of a stack — all corners flat, no shadow
 * - 'last':   bottom of a stack — top flat, bottom rounded, no shadow
 *
 * The visible row in the desktop multi-role expand pattern uses 'last' when collapsed
 * (square top, rounded bottom — reads as a "tab" hanging from above) and 'middle' when
 * expanded (square all — joins the hidden rows seamlessly).
 */
type AbilityRowPosition = 'solo' | 'first' | 'middle' | 'last';

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
  // Dual-ink cards take their primary ink (card.ink); secondary ink (card.ink2)
  // is intentionally ignored to keep the chip a single swatch.

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') {
          return <span key={i}>{seg.text}</span>;
        }
        if (seg.kind === 'token') {
          const refCard = seg.card === 'a' ? cardA : cardB;
          // Chip displays the initial letter of the card's base name (e.g. Yzma → Y,
          // Kuzco → K) so the user can match chip → card by initial without hover.
          const initial = refCard.name.charAt(0).toUpperCase();
          return (
            <span
              key={i}
              onMouseEnter={onHighlight ? () => onHighlight(seg.card) : undefined}
              onMouseLeave={onHighlight ? () => onHighlight(null) : undefined}
              style={{
                display: 'inline-block',
                background: CHIP_BG_BY_INK[refCard.ink],
                color: CHIP_TEXT_BY_INK[refCard.ink],
                border: '1px solid #000000',
                fontWeight: 700,
                fontSize: 11,
                lineHeight: 1,
                padding: '4px 6px',
                borderRadius: 3,
                textAlign: 'center',
                // Reset textIndent so the parent AbilityRow's text-indent:-12px
                // (used to pull the role label flush left) doesn't cascade into
                // the chip's own text and shift the letter off-center.
                textIndent: 0,
                verticalAlign: 'baseline',
                cursor: onHighlight ? 'default' : 'inherit',
                userSelect: 'none',
              }}>
              {initial}
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

interface AbilityRowProps {
  label: string;
  description: string;
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  onHighlight?: (card: 'a' | 'b' | null) => void;
  position?: AbilityRowPosition;
  /** Optional click handler. When set, the row gets `cursor: pointer`, a gold
   *  hover glow, role="button", tabIndex, and Enter/Space keyboard parity.
   *  Used by MultiRoleAbilityList to make the visible row a secondary toggle
   *  alongside the chevron (which remains the canonical control). */
  onClick?: () => void;
}

function buildKeyDownHandler(onClick: (() => void) | undefined) {
  if (!onClick) return undefined;
  return (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
}

function buildHoverHandlers(interactive: boolean, setHovered: (b: boolean) => void) {
  if (!interactive) return {};
  return {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };
}

function pickRowRadii(position: AbilityRowPosition): React.CSSProperties {
  const topRounded = position === 'solo' || position === 'first';
  const bottomRounded = position === 'solo' || position === 'last';
  const r = `${RADIUS.sm}px`;
  return {
    borderTopLeftRadius: topRounded ? r : 0,
    borderTopRightRadius: topRounded ? r : 0,
    borderBottomLeftRadius: bottomRounded ? r : 0,
    borderBottomRightRadius: bottomRounded ? r : 0,
  };
}

function pickAbilityRowStyle({
  position,
  interactive,
  hovered,
}: {
  position: AbilityRowPosition;
  interactive: boolean;
  hovered: boolean;
}): React.CSSProperties {
  const withShadow = position === 'solo';
  return {
    background: COLORS.lorcanaCream,
    ...pickRowRadii(position),
    padding: '8px 12px',
    // textIndent pulls only line 1 back by `padding-left` so the label hugs
    // the container's left edge while wrapped lines stay indented at content-left.
    textIndent: -12,
    overflow: 'hidden',
    // Canonical gold-glow hover pattern from the rest of the app
    // (see SynergyGroup.tsx:216, BetaNotice, CardLightbox, voting cards).
    boxShadow:
      interactive && hovered
        ? '0 0 16px rgba(212, 175, 55, 0.15)'
        : withShadow
          ? ABILITY_BOX_SHADOW
          : 'none',
    color: COLORS.lorcanaTextDark,
    fontFamily: FONTS.body,
    fontSize: `${FONT_SIZES.base}px`,
    fontWeight: 600,
    lineHeight: DESCRIPTION_LINE_HEIGHT,
    cursor: interactive ? 'pointer' : undefined,
    transition: 'box-shadow 0.2s ease-out',
  };
}

function AbilityRow({label, description, cardA, cardB, onHighlight, position = 'solo', onClick}: AbilityRowProps) {
  const interactive = !!onClick;
  const [hovered, setHovered] = useState(false);
  return (
    // Lorcana ability-text layout: cream container with a small dark label inline at the
    // start of the text flow. Line 1 (label + start of description) sits flush against the
    // container's left border via text-indent; wrapped lines (line 2+) are governed by
    // padding-left so they have breathing room from the border instead of touching it.
    <div
      onClick={onClick}
      onKeyDown={buildKeyDownHandler(onClick)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...buildHoverHandlers(interactive, setHovered)}
      style={pickAbilityRowStyle({position, interactive, hovered})}>
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

// ── Multi-role expand/collapse subcomponents ──

/** Feather chevron-down (https://feathericons.com/) — inline SVG to match project style. */
function ChevronDownIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ToggleButton({
  isOpen,
  onClick,
  totalRoles,
}: {
  isOpen: boolean;
  onClick: () => void;
  totalRoles: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-label={isOpen ? 'Hide additional roles' : `Show all ${totalRoles} roles`}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: COLORS.lorcanaTagBg,
        color: COLORS.lorcanaTagText,
        border: `2px solid ${COLORS.lorcanaCream}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.25s ease',
        padding: 0,
      }}>
      <ChevronDownIcon />
    </button>
  );
}

/** Map a row's index within a stack to its corner-radius variant. */
function pickStackPosition(index: number, total: number): AbilityRowPosition {
  if (total === 1) return 'solo';
  if (index === 0) return 'first';
  if (index === total - 1) return 'last';
  return 'middle';
}

/** Resolve a connection's display label + description, using engine role tables. */
function resolveRoleDisplay(
  conn: PairSynergyConnection,
  cardA: LorcanaCard,
  cardB: LorcanaCard,
): {key: string; label: string; description: string} {
  const role = extractLocationRole(conn.ruleId);
  const label = role ? LOCATION_ROLE_CHIP_LABELS[role] : conn.ruleName;
  const description = role
    ? LOCATION_ROLE_DESCRIPTIONS[role](
        getRoleSourceName(conn, cardA, cardB),
        getLocationName(cardA, cardB),
      )
    : conn.explanation;
  return {key: conn.ruleId, label, description};
}

/**
 * Multi-role display for connection groups with >1 sub-rule (e.g. Location Control's
 * At-Payoff + Move + Buff).
 *
 * Desktop: shows only the highest-scoring role's row + a circular toggle button.
 * Click expands the rest in an absolute-positioned overlay below the visible row,
 * so the engine column doesn't grow — the expansion floats over content below.
 *
 * Mobile: stacks all roles always-open. No toggle, no overlay (mobile lays the
 * modal columns vertically, so engine column height isn't constrained).
 */
function useEscapeToClose(active: boolean, setIsOpen: (v: boolean) => void) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [active, setIsOpen]);
}

function MultiRoleAbilityList({
  connections,
  cardA,
  cardB,
  onHighlight,
}: {
  connections: PairSynergyConnection[];
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  onHighlight?: (card: 'a' | 'b' | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const {isMobile} = useResponsive();

  // Sort by score desc so the highest-scoring role becomes the visible top row on desktop
  // and the first row on mobile. groupConnections() doesn't sort within a group.
  const roles = [...connections]
    .sort((a, b) => b.score - a.score)
    .map((conn) => resolveRoleDisplay(conn, cardA, cardB));

  // Esc closes the expansion (desktop only — mobile has no toggle).
  useEscapeToClose(!isMobile && isOpen, setIsOpen);

  if (isMobile) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', gap: 0}}>
        {roles.map((r, i) => (
          <AbilityRow
            key={r.key}
            label={r.label}
            description={r.description}
            cardA={cardA}
            cardB={cardB}
            onHighlight={onHighlight}
            position={pickStackPosition(i, roles.length)}
          />
        ))}
      </div>
    );
  }

  // Desktop — visible row + absolute-positioned overlay extension.
  // Visible row position: 'last' (square top, rounded bottom) when collapsed,
  // 'middle' (square all) when expanded so it joins the hidden rows seamlessly.
  const [visibleRole, ...hiddenRoles] = roles;
  return (
    <div
      style={{position: 'relative'}}
      // Close on hover-out — when expanded and the pointer leaves the entire
      // visual area (visible row + absolute overlay are both descendants of
      // this root, so mouseleave fires only on a true exit, not when crossing
      // between them).
      onMouseLeave={() => {
        if (isOpen) setIsOpen(false);
      }}>
      <AbilityRow
        label={visibleRole.label}
        description={visibleRole.description}
        cardA={cardA}
        cardB={cardB}
        onHighlight={onHighlight}
        position={isOpen ? 'middle' : 'last'}
        // Secondary toggle affordance: clicking anywhere on the visible row
        // flips the expansion. Only enabled when there are hidden rows to
        // reveal (i.e., the chevron button is rendered). The ToggleButton
        // remains the canonical keyboard-accessible control.
        onClick={hiddenRoles.length > 0 ? () => setIsOpen((o) => !o) : undefined}
      />
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 5,
          // Pass clicks through except on the interactive children (the hidden roles
          // wrapper and the toggle button). Otherwise the absolute container would
          // intercept clicks targeting content visually below it.
          pointerEvents: 'none',
        }}>
        <div
          style={{
            display: 'grid',
            // CSS Grid 0fr → 1fr trick gives a smooth height-from-zero animation
            // without measuring content height in JS.
            gridTemplateRows: isOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 0.25s ease-out',
            pointerEvents: 'auto',
          }}>
          <div
            style={{
              overflow: 'hidden',
              minHeight: 0,
              // Elevated-popover shadow when expanded. Box-shadow renders outside
              // the element's box (overflow:hidden doesn't clip it), so the
              // expanded panel reads as a floating layer above the engine column.
              // Layered shadow: deep outer dark for depth on the dark background,
              // plus a subtle gold edge highlight to align with the brand palette.
              boxShadow: isOpen
                ? '0 18px 36px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(212, 175, 55, 0.18)'
                : 'none',
              transition: 'box-shadow 0.25s ease-out',
            }}>
            {hiddenRoles.map((r, i) => (
              <AbilityRow
                key={r.key}
                label={r.label}
                description={r.description}
                cardA={cardA}
                cardB={cardB}
                onHighlight={onHighlight}
                position={i === hiddenRoles.length - 1 ? 'last' : 'middle'}
              />
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            // Half the button height — straddles the bottom border of whatever
            // sits above (visible row when collapsed, last hidden row when open).
            marginTop: -14,
            pointerEvents: 'auto',
          }}>
          <ToggleButton
            isOpen={isOpen}
            onClick={() => setIsOpen((o) => !o)}
            totalRoles={roles.length}
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ──

/**
 * Lorcana ability-box row variant for a synergy rule (or a multi-role playstyle group).
 * Single-rule groups render as one ability box. Multi-role groups (Location Control)
 * render via {@link MultiRoleAbilityList} — desktop hides extra roles behind a toggle,
 * mobile stacks them all.
 */
export function ConnectionGroup({group, cardA, cardB, onHighlight}: ConnectionGroupProps) {
  if (group.connections.length > 1) {
    return (
      <MultiRoleAbilityList
        connections={group.connections}
        cardA={cardA}
        cardB={cardB}
        onHighlight={onHighlight}
      />
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
