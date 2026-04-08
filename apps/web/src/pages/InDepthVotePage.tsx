import {useNavigate, useParams} from 'react-router-dom';
import {CompactHeader, CtaButton, BackLink, LoadingSpinner, EtherealBackground} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {PairDisplay, VoteStatusBanner, InDepthVoteForm} from '../features/voting';
import {useSpecificPair} from '../features/voting/hooks/useSpecificPair';
import {useInDepthVoteSession} from '../features/voting/hooks/useInDepthVoteSession';
import {COLORS, FONTS, FONT_SIZES} from '../shared/constants';

export function InDepthVotePage() {
  const navigate = useNavigate();
  const {cardAId, cardBId} = useParams<{cardAId: string; cardBId: string}>();
  const {isMobile} = useResponsive();
  const {cards} = useCardDataContext();

  const {pair, isLoading, error} = useSpecificPair(cardAId, cardBId);
  const session = useInDepthVoteSession(pair);

  const handleBack = () => {
    // Navigate back — if coming from modal, goes to the card page
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/card/${cardAId}`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error || !pair) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
        <CompactHeader
          onLogoClick={() => navigate('/')}
          isMobile={isMobile}
          cards={cards}
          onCardSelect={(card) => navigate(`/card/${card.id}`)}
        />
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            gap: 16,
          }}>
          <span style={{fontSize: FONT_SIZES.xl, fontWeight: 700, color: COLORS.text, fontFamily: FONTS.body}}>
            {error ?? 'Pair not found'}
          </span>
          <CtaButton variant="ghost" onClick={() => navigate('/')}>
            Back to Home
          </CtaButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', overflowY: 'auto'}}>
      <EtherealBackground isMobile={isMobile} vivid />
      <CompactHeader
        onLogoClick={() => navigate('/')}
        isMobile={isMobile}
        cards={cards}
        onCardSelect={(card) => navigate(`/card/${card.id}`)}
      />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: isMobile ? '16px 16px 120px' : '16px 16px 60px',
          gap: 16,
          position: 'relative',
          zIndex: 1,
        }}>
        {/* Back navigation */}
        <div style={{width: '100%', maxWidth: 520}}>
          <BackLink onClick={handleBack} label="Back to synergy" />
        </div>

        {/* Pair display — static, no stacks or transitions */}
        <PairDisplay
          pair={pair}
          selectedScore={session.formState.score}
          isMobile={isMobile}
        />

        {/* Page subtitle */}
        <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontFamily: FONTS.body, textAlign: 'center'}}>
          Answer any or all — every response helps calibrate synergy scores.
        </span>

        {/* Status banners */}
        {session.isRateLimited && (
          <div style={{width: '100%', maxWidth: 520}}>
            <VoteStatusBanner type="rate_limited" />
          </div>
        )}
        {session.lastResult === 'error' && (
          <div style={{width: '100%', maxWidth: 520}}>
            <VoteStatusBanner type="error" />
          </div>
        )}

        {/* Success state */}
        {session.lastResult === 'success' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              padding: 32,
            }}>
            <span style={{fontSize: FONT_SIZES.xl, fontWeight: 700, color: COLORS.primary, fontFamily: FONTS.body}}>
              Thanks for your feedback!
            </span>
            <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontFamily: FONTS.body}}>
              Your votes help improve synergy accuracy for the community.
            </span>
            <div style={{display: 'flex', gap: 12, marginTop: 8}}>
              <CtaButton onClick={handleBack}>
                Back to synergy
              </CtaButton>
              <CtaButton variant="ghost" onClick={() => navigate('/vote')}>
                Vote on more pairs
              </CtaButton>
            </div>
          </div>
        ) : (
          /* Vote form + submit button */
          <div style={{width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center'}}>
            <InDepthVoteForm
              formState={session.formState}
              cardA={pair.cardA}
              cardB={pair.cardB}
              onSetIsReal={session.setIsReal}
              onSetAccuracy={session.setAccuracy}
              onSetScore={session.setScore}
              onSetWouldPlay={session.setWouldPlay}
              onSetWhoCarries={session.setWhoCarries}
              onSetDifficulty={session.setDifficulty}
              isMobile={isMobile}
            />

            <CtaButton
              onClick={session.submit}
              disabled={!session.hasAnyAnswer || session.isSubmitting || session.isRateLimited}
              style={{width: '100%', maxWidth: 520, opacity: session.hasAnyAnswer ? 1 : 0.5}}>
              {session.isSubmitting ? 'Submitting...' : 'Submit Votes'}
            </CtaButton>
          </div>
        )}
      </main>
    </div>
  );
}
