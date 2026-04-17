import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CompactHeader, ErrorBoundary, EtherealBackground} from '../shared/components';
import {BrowseCardGrid} from '../features/cards';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useManifest} from '../features/reveals';
import {useResponsive} from '../shared/hooks';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
import type {LorcanaCard} from '../features/cards/types';

const SET_12_CODE = '12';

type Franchise = 'toy-story' | 'incredibles' | 'brave';

const FRANCHISES: {id: Franchise; label: string; match: string}[] = [
  {id: 'toy-story', label: 'Toy Story', match: 'Toy Story'},
  {id: 'incredibles', label: 'The Incredibles', match: 'The Incredibles'},
  {id: 'brave', label: 'Brave', match: 'Brave'},
];

/**
 * Filter cards by franchise using the explicit `franchise` field on preview cards.
 * Only Set 12 preview cards have this field set; main-pool cards return null/undefined
 * and are filtered out when a franchise is active.
 */
function matchesFranchise(card: LorcanaCard, franchise: Franchise | null): boolean {
  if (!franchise) return true;
  const config = FRANCHISES.find((f) => f.id === franchise);
  if (!config) return true;
  return card.franchise === config.match;
}

export function RevealsPage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards, isLoading, error} = useCardDataContext();
  const {hasSynergies} = useManifest();
  const [activeFranchise, setActiveFranchise] = useState<Franchise | null>(null);

  const set12Cards = cards.filter((c) => c.setCode === SET_12_CODE);
  const visibleCards = set12Cards.filter((c) => matchesFranchise(c, activeFranchise));

  const toggleFranchise = (franchise: Franchise) => {
    setActiveFranchise((current) => (current === franchise ? null : franchise));
  };

  const selectCard = (card: LorcanaCard) => {
    if (hasSynergies(card.id)) {
      navigate(`/card/${card.id}`);
    }
  };

  if (error) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: COLORS.text,
          padding: 32,
          textAlign: 'center',
        }}>
        <div>
          <h1 style={{fontFamily: FONTS.hero, fontSize: 24}}>Failed to load card data</h1>
          <p style={{color: COLORS.textMuted}}>{error.message}</p>
        </div>
      </main>
    );
  }

  return (
    <ErrorBoundary>
      <EtherealBackground />
      <CompactHeader />
      <main
        style={{
          minHeight: '100vh',
          paddingTop: 80,
          color: COLORS.text,
        }}>
        <section
          aria-labelledby="reveals-heading"
          style={{
            padding: `${SPACING.xl}px ${SPACING.lg}px`,
            textAlign: 'center',
            maxWidth: 1200,
            margin: '0 auto',
          }}>
          <h1
            id="reveals-heading"
            style={{
              fontFamily: FONTS.hero,
              fontSize: isMobile ? 32 : 48,
              margin: 0,
              color: COLORS.primary,
              letterSpacing: '0.1em',
            }}>
            THE WILDS UNKNOWN
          </h1>
          <p
            style={{
              fontFamily: FONTS.body,
              fontSize: FONT_SIZES.base,
              color: COLORS.textMuted,
              marginTop: 8,
            }}>
            Set 12 preview cards — Pixar arrives in Lorcana
          </p>

          <div
            role="group"
            aria-label="Filter by franchise"
            style={{
              display: 'flex',
              gap: SPACING.sm,
              justifyContent: 'center',
              marginTop: SPACING.lg,
              flexWrap: 'wrap',
            }}>
            {FRANCHISES.map((f) => {
              const isActive = activeFranchise === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggleFranchise(f.id)}
                  aria-pressed={isActive}
                  style={{
                    padding: '10px 20px',
                    fontSize: FONT_SIZES.base,
                    fontFamily: FONTS.body,
                    fontWeight: isActive ? 600 : 500,
                    background: isActive ? COLORS.primary : 'transparent',
                    color: isActive ? COLORS.background : COLORS.text,
                    border: `1px solid ${isActive ? COLORS.primary : COLORS.surfaceBorder}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </section>

        {set12Cards.length === 0 ? (
          <section
            aria-label="No reveals yet"
            style={{
              textAlign: 'center',
              padding: 64,
              color: COLORS.textMuted,
              fontSize: FONT_SIZES.xl,
              fontFamily: FONTS.body,
            }}>
            No cards revealed yet. Check back soon.
          </section>
        ) : (
          <BrowseCardGrid
            cards={visibleCards}
            isLoading={isLoading}
            onCardSelect={selectCard}
            usePageScroll
          />
        )}
      </main>
    </ErrorBoundary>
  );
}
