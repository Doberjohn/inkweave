import {useCallback, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FeaturedCards} from '../features/cards';
import {HeroSection, EtherealBackground} from '../shared/components';
import {COLORS, FONT_SIZES} from '../shared/constants';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';

export function HomePage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards} = useCardDataContext();
  const [searchQuery, setSearchQuery] = useState('');

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
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        ...(isMobile ? {} : {justifyContent: 'center'}),
      }}>
      <EtherealBackground isMobile={isMobile} />

      <HeroSection
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        isMobile={isMobile}
      />

      <FeaturedCards
        cards={cards}
        onCardSelect={handleCardSelect}
        isMobile={isMobile}
      />

      {/* See all cards link */}
      <button
        onClick={handleSeeAll}
        style={{
          background: 'none',
          border: 'none',
          color: COLORS.primary,
          fontSize: `${isMobile ? FONT_SIZES.md : FONT_SIZES.lg}px`,
          cursor: 'pointer',
          padding: isMobile ? '0 0 48px' : '24px 0 48px',
          position: 'relative',
          zIndex: 1,
          letterSpacing: '1px',
        }}>
        See all cards →
      </button>
    </div>
  );
}
