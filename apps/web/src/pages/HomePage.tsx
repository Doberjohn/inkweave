import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {FeaturedCards} from '../features/cards';
import {trackCardSelected} from '../features/cards/lib/cardAnalytics';
import {trackEvent} from '../shared/lib/analytics';
import {HeroSection, EtherealBackground, ErrorBoundary, Footer} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useCardModal} from '../shared/contexts/CardModalContext';

const mainStyle: React.CSSProperties = {
  flex: 1,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

export function HomePage() {
  const navigate = useNavigate();
  const {openCardModal} = useCardModal();
  const {isMobile} = useResponsive();
  const {cards, isLoading, getCardById} = useCardDataContext();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = () => {
    const q = searchQuery.trim();
    if (q) trackEvent('search_submitted', {query: q, source: 'home'});
    navigate(q ? `/browse?q=${encodeURIComponent(q)}` : '/browse');
  };
  const handleCardSelect = (card: {id: string}) => {
    trackCardSelected(getCardById(card.id), 'home');
    openCardModal(card.id);
  };
  const handleBrowse = () => navigate('/browse');
  const handlePlaystyles = () => navigate('/playstyles');
  const handleVote = () => navigate('/vote');

  return (
    <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
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
            onVote={handleVote}
            isMobile={isMobile}
          />
        </ErrorBoundary>

        <FeaturedCards
          cards={cards}
          onCardSelect={handleCardSelect}
          isMobile={isMobile}
          isLoading={isLoading}
        />
      </main>
      <Footer />
    </div>
  );
}
