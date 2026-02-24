import {useCallback, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FeaturedCards} from '../features/cards';
import {HeroSection, EtherealBackground, ErrorBoundary} from '../shared/components';
import {COLORS, FONT_SIZES} from '../shared/constants';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';

function getStyles(isMobile: boolean) {
  return {
    main: {
      minHeight: '100vh',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: isMobile ? undefined : 'center',
    } as React.CSSProperties,
    seeAllButton: {
      background: 'none',
      border: 'none',
      color: COLORS.primary,
      fontSize: `${isMobile ? FONT_SIZES.md : FONT_SIZES.lg}px`,
      cursor: 'pointer',
      padding: isMobile ? '0 0 48px' : '24px 0 48px',
      position: 'relative',
      zIndex: 1,
      letterSpacing: '1px',
    } as React.CSSProperties,
  };
}

export function HomePage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards} = useCardDataContext();
  const [searchQuery, setSearchQuery] = useState('');
  const styles = getStyles(isMobile);

  const handleSearchSubmit = useCallback(() => {
    const q = searchQuery.trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  }, [navigate, searchQuery]);
  const handleCardSelect = useCallback(
    (card: {id: string}) => navigate(`/card/${card.id}`),
    [navigate],
  );
  const handleSeeAll = useCallback(() => navigate('/browse'), [navigate]);

  return (
    <main style={styles.main}>
      <EtherealBackground isMobile={isMobile} />

      <ErrorBoundary>
        <HeroSection
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          cards={cards}
          onCardSelect={handleCardSelect}
          isMobile={isMobile}
        />
      </ErrorBoundary>

      <FeaturedCards cards={cards} onCardSelect={handleCardSelect} isMobile={isMobile} />

      {/* See all cards link */}
      <button onClick={handleSeeAll} style={styles.seeAllButton}>
        See all cards →
      </button>

      {/* TEMPORARY: Sentry source map test — remove after verifying */}
      <button
        onClick={() => { throw new Error('Sentry source map test from HomePage'); }}
        style={{position: 'fixed', bottom: 8, right: 8, zIndex: 9999, fontSize: '10px', opacity: 0.3}}
      >
        Test Sentry
      </button>
    </main>
  );
}
