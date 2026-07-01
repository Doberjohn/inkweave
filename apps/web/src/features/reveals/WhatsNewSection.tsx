import {useState, type ReactNode} from 'react';
import './reveals.css';
import {COLORS, FONTS} from '../../shared/constants';
import type {FranchiseConfig} from './franchise';
import {SpotlightHero} from './SpotlightHero';
import {SET_SPOTLIGHTS, FRANCHISE_SPOTLIGHTS} from './setSpotlights';

interface WhatsNewSectionProps {
  compact?: boolean;
  /** Opens a franchise's cards modal when its spotlight is clicked. */
  onSelectFranchise?: (franchise: FranchiseConfig) => void;
  /** Opens the Team-characters cards modal when the Team spotlight is clicked. */
  onSelectTeam?: () => void;
}

interface TabDef {
  key: string;
  label: string;
  cards: ReactNode[];
}

/** Build the tab set: debut franchises first, then one tab per set-spotlight group. */
function buildTabs(
  compact: boolean,
  onSelectFranchise?: (franchise: FranchiseConfig) => void,
  onSelectTeam?: () => void,
): TabDef[] {
  return [
    {
      key: 'franchises',
      label: 'New franchises',
      cards: FRANCHISE_SPOTLIGHTS.map(({config, data}) => (
        <SpotlightHero key={config.id} data={data} compact={compact} onActivate={() => onSelectFranchise?.(config)} />
      )),
    },
    ...SET_SPOTLIGHTS.map((group) => ({
      key: group.eyebrow,
      label: group.eyebrow,
      cards: group.items.map((item) => (
        <SpotlightHero key={item.id} data={item} compact={compact} onActivate={item.id === 'team' ? onSelectTeam : undefined} />
      )),
    })),
  ];
}

/** One pill in the What's-New tab bar; active state drives colour, glow, and border. */
function WhatsNewTab({label, isActive, compact, id, controls, onSelect}: {label: string; isActive: boolean; compact: boolean; id: string; controls: string; onSelect: () => void}) {
  const tone = isActive
    ? {
        border: COLORS.primary500,
        background: 'linear-gradient(180deg, rgba(255, 185, 0, 0.28) 0%, rgba(255, 185, 0, 0.14) 100%)',
        color: COLORS.primary,
        boxShadow: '0 0 20px rgba(255, 185, 0, 0.35)',
      }
    : {
        border: 'rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.02)',
        color: '#90a1b9',
        boxShadow: 'none',
      };
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-selected={isActive}
      aria-controls={controls}
      onClick={onSelect}
      style={{
        appearance: 'none',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: compact ? 12 : 13,
        fontWeight: 600,
        letterSpacing: 0.3,
        padding: compact ? '7px 14px' : '9px 18px',
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        boxShadow: tone.boxShadow,
        transition: 'color 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
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
 * The reveals "What's New in Set 13" band. A tab bar (debut franchises, new
 * mechanics, tribe spotlights) keeps the section compact by showing one group of
 * cinematic SpotlightHero cards at a time. Slots below the ink board in the
 * reveals Tracker view (replacing the separate new-franchises section).
 */
export function WhatsNewSection({compact = false, onSelectFranchise, onSelectTeam}: WhatsNewSectionProps) {
  const [active, setActive] = useState(0);
  const tabs = buildTabs(compact, onSelectFranchise, onSelectTeam);
  const s = compact ? COMPACT_SECTION : FULL_SECTION;

  return (
    <section>
      <div style={{textAlign: 'center', marginBottom: s.headerMargin}}>
        <div
          style={{
            fontWeight: 600,
            fontSize: s.eyebrowSize,
            letterSpacing: s.eyebrowSpacing,
            textTransform: 'uppercase',
            color: '#d4af37',
          }}
        >
          New this set
        </div>
        <h2 style={{fontFamily: FONTS.hero, fontWeight: 700, fontSize: s.titleSize, color: '#ececf2', margin: '10px 0 0'}}>
          What&apos;s new in Set 13
        </h2>
      </div>

      <div
        role="tablist"
        aria-label="What's new categories"
        style={{display: 'flex', justifyContent: 'center', gap: s.tablistGap, flexWrap: 'wrap', marginBottom: s.tablistMargin}}
      >
        {tabs.map((t, i) => (
          <WhatsNewTab
            key={t.key}
            id={`whatsnew-tab-${i}`}
            controls="whatsnew-panel"
            label={t.label}
            isActive={i === active}
            compact={compact}
            onSelect={() => setActive(i)}
          />
        ))}
      </div>

      <div
        role="tabpanel"
        id="whatsnew-panel"
        aria-labelledby={`whatsnew-tab-${active}`}
        tabIndex={0}
        style={{display: 'flex', flexDirection: 'column', gap: s.panelGap}}
      >
        {tabs[active].cards}
      </div>
    </section>
  );
}
