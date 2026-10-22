import {useRef, useState} from 'react';
import {
  COLORS,
  DURATION,
  EASING,
  FONTS,
  FONT_SIZES,
  RADIUS,
  SPACING,
  TOUCH_TARGET,
  hexRgba,
  whiteRgba,
} from '../../../shared/constants';

/** A question group's tab: its key, its name and its colour. */
interface VoteGroupTab<K extends string> {
  key: K;
  label: string;
  accent: string;
}

interface VoteGroupTabsProps<K extends string> {
  groups: readonly VoteGroupTab<K>[];
  activeTab: K;
  onTabChange: (tab: K) => void;
  /** Questions answered in each group, out of the two each one asks. */
  answeredByGroup: Record<K, number>;
}

/** Questions per group: each tab counts its answers out of this. */
const GROUP_TOTAL = 2;

interface TabStyleInput {
  isActive: boolean;
  isHovered: boolean;
  accent: string;
}

function getTabBorder({isActive, isHovered, accent}: TabStyleInput): string {
  if (isActive) return `2px solid ${accent}`;
  if (isHovered) return `1px solid ${hexRgba(accent, 0.4)}`;
  return `1px solid ${whiteRgba(0.08)}`;
}

function getTabBackground({isActive, isHovered, accent}: TabStyleInput): string {
  if (isActive) return hexRgba(accent, 0.06);
  if (isHovered) return hexRgba(accent, 0.03);
  return whiteRgba(0.02);
}

function getTabColor({isActive, isHovered, accent}: TabStyleInput): string {
  if (isActive) return accent;
  if (isHovered) return COLORS.text;
  return COLORS.textMuted;
}

function getTabStyle(input: TabStyleInput): React.CSSProperties {
  return {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: RADIUS.lg,
    border: getTabBorder(input),
    background: getTabBackground(input),
    color: getTabColor(input),
    fontSize: FONT_SIZES.base,
    fontWeight: input.isActive ? 700 : 500,
    fontFamily: FONTS.body,
    cursor: 'pointer',
    padding: `${SPACING.sm}px ${SPACING.xs}px`,
    transition: `all ${DURATION.base}ms ${EASING.snappy}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: SPACING.xxs,
    boxShadow: input.isHovered ? `0 0 12px ${hexRgba(input.accent, 0.08)}` : 'none',
  };
}

/**
 * The in-depth vote page's question groups as tabs (InDepthVoteForm's tabbed layout), each in its
 * group's colour with its answers counted. A tab family of its own, so the lint rule's
 * no-adhoc-buttons exempts this file by name (#835). It keeps TabList's keyboard contract: only
 * the open tab is in the Tab order, and Left and Right move focus and selection, wrapping at the
 * ends. Only the open tab names a panel, since the form renders only that one.
 */
export function VoteGroupTabs<K extends string>({
  groups,
  activeTab,
  onTabChange,
  answeredByGroup,
}: VoteGroupTabsProps<K>) {
  const [hoveredTab, setHoveredTab] = useState<K | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (index + dir + groups.length) % groups.length;
    onTabChange(groups[next].key);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="Vote dimension groups"
      style={{display: 'flex', gap: SPACING.xs, width: '100%', marginBottom: SPACING.lg}}>
      {groups.map(({key, label, accent}, i) => {
        const isActive = activeTab === key;
        const isHovered = hoveredTab === key && !isActive;
        const groupAnswered = answeredByGroup[key];
        return (
          <button
            key={key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={isActive ? `panel-${key}` : undefined}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onMouseEnter={() => setHoveredTab(key)}
            onMouseLeave={() => setHoveredTab(null)}
            style={getTabStyle({isActive, isHovered, accent})}>
            <span>{label}</span>
            <span style={{fontSize: FONT_SIZES.xs, opacity: 0.7}}>
              {groupAnswered === GROUP_TOTAL ? '✓' : `${groupAnswered}/${GROUP_TOTAL}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
