import {useState} from 'react';
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

/**
 * The reveals "What's New in Set 13" band. A tab bar (debut franchises, new
 * mechanics, tribe spotlights) keeps the section compact by showing one group of
 * cinematic SpotlightHero cards at a time. Slots below the ink board in the
 * reveals Tracker view (replacing the separate new-franchises section).
 */
export function WhatsNewSection({compact = false, onSelectFranchise, onSelectTeam}: WhatsNewSectionProps) {
  const tabs = [
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

  const [active, setActive] = useState(0);

  return (
    <section>
      <div style={{textAlign: 'center', marginBottom: compact ? 16 : 22}}>
        <div
          style={{
            fontWeight: 600,
            fontSize: compact ? 10 : 12,
            letterSpacing: compact ? 2.2 : 2.8,
            textTransform: 'uppercase',
            color: '#d4af37',
          }}
        >
          New this set
        </div>
        <h2 style={{fontFamily: FONTS.hero, fontWeight: 700, fontSize: compact ? 23 : 32, color: '#ececf2', margin: '10px 0 0'}}>
          What&apos;s new in Set 13
        </h2>
      </div>

      <div
        role="tablist"
        aria-label="What's new categories"
        style={{display: 'flex', justifyContent: 'center', gap: compact ? 6 : 10, flexWrap: 'wrap', marginBottom: compact ? 18 : 26}}
      >
        {tabs.map((t, i) => {
          const isActive = i === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(i)}
              style={{
                appearance: 'none',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: compact ? 12 : 13,
                fontWeight: 600,
                letterSpacing: 0.3,
                padding: compact ? '7px 14px' : '9px 18px',
                borderRadius: 999,
                border: `1px solid ${isActive ? COLORS.primary500 : 'rgba(255, 255, 255, 0.1)'}`,
                background: isActive
                  ? 'linear-gradient(180deg, rgba(255, 185, 0, 0.28) 0%, rgba(255, 185, 0, 0.14) 100%)'
                  : 'rgba(255, 255, 255, 0.02)',
                color: isActive ? COLORS.primary : '#90a1b9',
                boxShadow: isActive ? '0 0 20px rgba(255, 185, 0, 0.35)' : 'none',
                transition: 'color 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" style={{display: 'flex', flexDirection: 'column', gap: compact ? 14 : 18}}>
        {tabs[active].cards}
      </div>
    </section>
  );
}
