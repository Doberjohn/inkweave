import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {CompactHeader, ErrorBoundary, EtherealBackground} from '../shared/components';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
import {useResponsive} from '../shared/hooks';
import {
  FranchiseTier,
  Hero,
  fetchRevealDates,
  useCountdown,
  useRevealCards,
  useRevealPhase,
  type RevealDates,
} from '../features/reveals';

const FIRST_TIER_PRIORITY_COUNT = 6;

export function RevealsPage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const phase = useRevealPhase();
  const {tiers, loading, error} = useRevealCards();
  const [dates, setDates] = useState<RevealDates | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRevealDates().then((d) => {
      if (!cancelled) setDates(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const target = dates
    ? phase === 'pre-release'
      ? dates.prereleaseDate
      : dates.releaseDate
    : null;
  const {days} = useCountdown(target);

  return (
    <ErrorBoundary>
      <EtherealBackground />
      <CompactHeader onLogoClick={() => navigate('/')} isMobile={isMobile} />
      <main style={{minHeight: '100vh', paddingTop: SPACING.lg, position: 'relative', zIndex: 1}}>
        <Hero phase={phase} days={days} />
        {error && (
          <p
            role="alert"
            style={{
              padding: SPACING.lg,
              textAlign: 'center',
              color: COLORS.error,
              fontFamily: FONTS.body,
              fontSize: FONT_SIZES.base,
            }}>
            Could not load reveal cards. Please try again later.
          </p>
        )}
        {loading && !error && (
          <p
            style={{
              padding: SPACING.lg,
              textAlign: 'center',
              color: COLORS.textMuted,
              fontFamily: FONTS.body,
              fontSize: FONT_SIZES.base,
            }}>
            Loading reveal cards…
          </p>
        )}
        {!loading &&
          !error &&
          tiers.map((tier, index) => (
            <FranchiseTier
              key={tier.id}
              tier={tier}
              priorityCount={index === 0 ? FIRST_TIER_PRIORITY_COUNT : 0}
            />
          ))}
      </main>
    </ErrorBoundary>
  );
}
