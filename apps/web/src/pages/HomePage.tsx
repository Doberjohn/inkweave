import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FeaturedCards} from '../features/cards';
import {HeroSection, EtherealBackground, ErrorBoundary} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';

const mainStyle: React.CSSProperties = {
  minHeight: '100vh',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

export function HomePage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {cards} = useCardDataContext();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = () => {
    const q = searchQuery.trim();
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  };
  const handleCardSelect = (card: {id: string}) => navigate(`/card/${card.id}`);
  const handleBrowse = () => navigate('/browse');
  const handlePlaystyles = () => navigate('/playstyles');

  return (
    <main style={{...mainStyle, justifyContent: isMobile ? undefined : 'center'}}>
      <EtherealBackground isMobile={isMobile} />

      <ErrorBoundary>
        <HeroSection
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          cards={cards}
          onCardSelect={handleCardSelect}
          onBrowse={handleBrowse}
          onPlaystyles={handlePlaystyles}
          isMobile={isMobile}
        />
      </ErrorBoundary>

      <FeaturedCards cards={cards} onCardSelect={handleCardSelect} isMobile={isMobile} />
    </main>
  );
}
