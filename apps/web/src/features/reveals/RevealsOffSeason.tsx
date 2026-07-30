import {useNavigate} from 'react-router-dom';
import {FullPageNotice} from '../../shared/components/FullPageNotice';
import {Seo} from '../../shared/components';
import {useRevealDates, type RevealDates} from './revealDates';

/** "24 July 2026" — the release date as the copy reads it. */
function formatReleaseDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'});
}

interface OffSeasonNoticeProps {
  /** The two phases that mean "not in season". */
  phase: 'hidden' | 'released';
  dates: RevealDates | null;
}

/**
 * Pure copy component, exported for unit testing (mirrors how `computePhase` is
 * exported from useRevealPhase).
 *
 * `released` names the set, `hidden` cannot because no season is configured. In
 * practice `dates` is never null when the phase is `released`, but the guarantee
 * is subtler than it looks: computePhase returns 'loading' before 'released'
 * whenever dates are missing, and useRevealDates seeds its state synchronously
 * from peekRevealDates(), so the cache fetchRevealDates already filled is present
 * on the FIRST render. Do not "simplify" that initialiser to useState(null): it
 * would make this branch reachable, and the page would flash the wrong headline.
 *
 * titleLevel 1 because this page has no hero mark: without it the page would have
 * no h1 at all, and unlike the 404 this route is indexable in season.
 */
export function OffSeasonNotice({phase, dates}: OffSeasonNoticeProps) {
  const navigate = useNavigate();
  const isReleased = phase === 'released' && dates !== null;

  const title = isReleased ? 'Reveal season has ended' : 'No reveal season right now';
  const lines: [string, string] = isReleased
    ? [
        `${dates.name || 'The set'} released on ${formatReleaseDate(dates.releaseDate)}.`,
        'The spoiler board is closed until the next set.',
      ]
    : [
        "Card reveals appear here when the next set's spoiler season begins.",
        'Until then, the full Core catalogue is a click away.',
      ];

  return (
    <FullPageNotice
      titleLevel={1}
      title={title}
      lines={lines}
      ctaLabel="Return to Inkweave"
      onCta={() => navigate('/')}
    />
  );
}

/**
 * Route-level wrapper: supplies the dates and owns the page's SEO.
 *
 * noindex because off-season there is genuinely nothing to index; in season the
 * route renders RevealsPage instead, so the tag goes away with the season. SEO
 * lives here rather than in OffSeasonNotice so the pure component stays free of
 * side effects and its tests and stories emit no meta tags.
 */
export function RevealsOffSeason({phase}: {phase: 'hidden' | 'released'}) {
  const dates = useRevealDates();
  return (
    <>
      <Seo title="Reveals | Inkweave" canonicalPath="/reveals" noindex />
      <OffSeasonNotice phase={phase} dates={dates} />
    </>
  );
}
