import {useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import './reveals.css';
import {
  COLORS,
  DURATION,
  EASING,
  FONTS,
  FONT_SIZES,
  FONT_WEIGHT,
  GOLD_GLOW,
  LETTER_SPACING,
  RADIUS,
  REVEAL_SET_NUMBER,
  SHADOWS,
  whiteRgba,
} from '../../shared/constants';
import type {FranchiseConfig} from './franchise';
import {SpotlightHero} from './SpotlightHero';
import {SET_SPOTLIGHTS, FRANCHISE_SPOTLIGHTS} from './setSpotlights';

interface WhatsNewSectionProps {
  compact?: boolean;
  /** Opens a franchise's cards modal when its spotlight is clicked. */
  onSelectFranchise?: (franchise: FranchiseConfig) => void;
}

interface TabDef {
  key: string;
  label: string;
  cards: ReactNode[];
}

/**
 * Build the tab set: debut franchises first, then one tab per set-spotlight
 * group. A group with nothing in it yet is dropped, so early in a season (before
 * the set's mechanics are revealed) the band is just the franchises.
 */
function buildTabs(compact: boolean, onSelectFranchise?: (franchise: FranchiseConfig) => void): TabDef[] {
  const tabs: TabDef[] = [
    {
      key: 'franchises',
      label: FRANCHISE_SPOTLIGHTS.length === 1 ? 'New franchise' : 'New franchises',
      cards: FRANCHISE_SPOTLIGHTS.map(({config, data}) => (
        <SpotlightHero key={config.id} data={data} compact={compact} onActivate={() => onSelectFranchise?.(config)} />
      )),
    },
    ...SET_SPOTLIGHTS.map((group) => ({
      key: group.eyebrow,
      label: group.eyebrow,
      cards: group.items.map((item) => <SpotlightHero key={item.id} data={item} compact={compact} />),
    })),
  ];
  return tabs.filter((t) => t.cards.length > 0);
}

const TAB_TRANSITION = ['color', 'background', 'border-color', 'box-shadow']
  .map((property) => `${property} ${DURATION.base}ms ${EASING.snappy}`)
  .join(', ');

interface WhatsNewTabProps {
  label: string;
  isActive: boolean;
  compact: boolean;
  index: number;
  buttonRef: (el: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

/** One pill in the What's-New tab bar; active state drives colour, glow, and border. */
function WhatsNewTab({label, isActive, compact, index, buttonRef, onSelect, onKeyDown}: WhatsNewTabProps) {
  const tone = isActive
    ? {
        border: COLORS.primary500,
        background: `linear-gradient(180deg, ${GOLD_GLOW.hoverBorder} 0%, ${GOLD_GLOW.activeBg} 100%)`,
        color: COLORS.primary,
        boxShadow: SHADOWS.glowMd,
      }
    : {
        border: whiteRgba(0.1),
        background: whiteRgba(0.02),
        color: COLORS.textMuted,
        boxShadow: 'none',
      };
  return (
    <button
      ref={buttonRef}
      type="button"
      role="tab"
      id={`whatsnew-tab-${index}`}
      aria-selected={isActive}
      aria-controls="whatsnew-panel"
      tabIndex={isActive ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      style={{
        appearance: 'none',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: compact ? FONT_SIZES.md : FONT_SIZES.base,
        fontWeight: FONT_WEIGHT.semibold,
        letterSpacing: LETTER_SPACING.slight,
        padding: compact ? '7px 14px' : '9px 18px',
        borderRadius: RADIUS.pill,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        boxShadow: tone.boxShadow,
        transition: TAB_TRANSITION,
      }}
    >
      {label}
    </button>
  );
}

/** Per-density layout values for the section chrome, resolved once from `compact`. */
interface SectionDims {
  headerMargin: number;
  eyebrowSize: number;
  eyebrowSpacing: number;
  titleSize: number;
  tablistGap: number;
  tablistMargin: number;
  panelGap: number;
}

const FULL_SECTION: SectionDims = {headerMargin: 22, eyebrowSize: 12, eyebrowSpacing: 2.8, titleSize: 32, tablistGap: 10, tablistMargin: 26, panelGap: 18};
const COMPACT_SECTION: SectionDims = {headerMargin: 16, eyebrowSize: 10, eyebrowSpacing: 2.2, titleSize: 23, tablistGap: 6, tablistMargin: 18, panelGap: 14};

/**
 * The tab bar keeps the ARIA tablist contract the kit's TabList keeps: one tab in the
 * tab order, and Left and Right move focus and selection, wrapping at the ends.
 */
function WhatsNewTabBar({tabs, current, compact, onSelect}: {tabs: TabDef[]; current: number; compact: boolean; onSelect: (index: number) => void}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = compact ? COMPACT_SECTION : FULL_SECTION;

  function onKeyDown(e: KeyboardEvent, index: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onSelect(next);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="What's new categories"
      style={{display: 'flex', justifyContent: 'center', gap: s.tablistGap, flexWrap: 'wrap', marginBottom: s.tablistMargin}}
    >
      {tabs.map((t, i) => (
        <WhatsNewTab
          key={t.key}
          index={i}
          buttonRef={(el) => {
            refs.current[i] = el;
          }}
          label={t.label}
          isActive={i === current}
          compact={compact}
          onSelect={() => onSelect(i)}
          onKeyDown={(e) => onKeyDown(e, i)}
        />
      ))}
    </div>
  );
}

/**
 * The reveals "What's New" band. A tab bar (debut franchises, new mechanics,
 * tribe spotlights) keeps the section compact by showing one group of cinematic
 * SpotlightHero cards at a time. With a single group there is nothing to switch
 * between, so the tab bar is dropped and the cards render as a plain panel. Slots
 * below the ink board in the reveals Tracker view.
 */
export function WhatsNewSection({compact = false, onSelectFranchise}: WhatsNewSectionProps) {
  const [active, setActive] = useState(0);
  const tabs = buildTabs(compact, onSelectFranchise);
  const s = compact ? COMPACT_SECTION : FULL_SECTION;
  if (tabs.length === 0) return null;

  const hasTabBar = tabs.length > 1;
  const current = Math.min(active, tabs.length - 1);
  const panelA11y = hasTabBar
    ? ({role: 'tabpanel', id: 'whatsnew-panel', 'aria-labelledby': `whatsnew-tab-${current}`, tabIndex: 0} as const)
    : {};

  return (
    <section>
      <div style={{textAlign: 'center', marginBottom: hasTabBar ? s.headerMargin : s.tablistMargin}}>
        <div
          style={{
            fontWeight: FONT_WEIGHT.semibold,
            fontSize: s.eyebrowSize,
            letterSpacing: s.eyebrowSpacing,
            textTransform: 'uppercase',
            color: COLORS.primary500,
          }}
        >
          New this set
        </div>
        <h2 style={{fontFamily: FONTS.hero, fontWeight: FONT_WEIGHT.regular, fontSize: s.titleSize, color: COLORS.text, margin: '10px 0 0'}}>
          What&apos;s new in Set {REVEAL_SET_NUMBER}
        </h2>
      </div>

      {hasTabBar && <WhatsNewTabBar tabs={tabs} current={current} compact={compact} onSelect={setActive} />}

      <div {...panelA11y} style={{display: 'flex', flexDirection: 'column', gap: s.panelGap}}>
        {tabs[current].cards}
      </div>
    </section>
  );
}
