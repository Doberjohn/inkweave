import {useNavigate, useParams} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardGrid, CardGridSkeleton, cardsForInk, getInkHub} from '../features/cards';
import {CompactHeader, EtherealBackground, Seo} from '../shared/components';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {sortBySetThenNumber} from '../features/cards';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, SPACING} from '../shared/constants';
import {NotFoundPage} from './NotFoundPage';

/**
 * `/ink/:inkSlug` — one hub per ink colour (#530).
 *
 * These pages exist for internal linking, not browsing: ink is the only total partition of
 * the corpus, so six hubs guarantee all 1,024 cards an inbound crawlable `<a>`. The grid
 * therefore uses `CardGrid` with `linkToCards` — the NON-virtualized grid — because
 * `BrowseCardGrid`'s Virtuoso windowing only mounts visible rows, which would emit a
 * fraction of the anchors to a crawler and defeat the entire purpose.
 *
 * Deliberately has no toolbar or filters. PlaystyleDetailPage is the interactive
 * counterpart; this is a directory page whose job is to be complete and indexable.
 */
export function InkHubPage() {
  const {inkSlug} = useParams<{inkSlug: string}>();
  const navigate = useNavigate();
  const {cards, isLoading} = useCardDataContext();
  const {openCardModal} = useCardModal();

  const hub = getInkHub(inkSlug);
  // Unknown slug renders the 404 page rather than an empty hub, so junk URLs under /ink/
  // declare themselves unindexable instead of returning a thin 200 (#525).
  if (!hub) return <NotFoundPage />;

  const inkCards = sortBySetThenNumber(cardsForInk(cards, hub.ink));
  const accent = INK_COLORS[hub.ink];

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
      <Seo
        title={`${hub.ink} Cards | Disney Lorcana | Inkweave`}
        description={hub.blurb}
        canonicalPath={`/ink/${hub.slug}`}
      />
      <EtherealBackground />
      <CompactHeader onLogoClick={() => navigate('/')} />

      <div
        style={{
          flex: 1,
          position: 'relative',
          zIndex: 1,
          padding: `${SPACING.xl}px`,
          maxWidth: 1320,
          width: '100%',
          margin: '0 auto',
        }}>
        <InkHubHeader ink={hub.ink} blurb={hub.blurb} accentBorder={accent.border} />

        {isLoading ? (
          <CardGridSkeleton rows={3} />
        ) : (
          <CardGrid
            cards={inkCards}
            onSelect={(card: LorcanaCard) =>
              openCardModal(
                card.id,
                inkCards.map((c) => c.id),
              )
            }
            linkToCards
            priorityCount={6}
            emptyMessage={`No ${hub.ink} cards found.`}
          />
        )}
      </div>
    </main>
  );
}

function InkHubHeader({
  ink,
  blurb,
  accentBorder,
}: {
  ink: string;
  blurb: string;
  accentBorder: string;
}) {
  return (
    <>
      {/* Breadcrumb — a real <a>, so the crawler walks hub -> index -> the other five. */}
      <nav
        aria-label="Breadcrumb"
        style={{
          fontSize: `${FONT_SIZES.base}px`,
          color: COLORS.textMuted,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: `${SPACING.md}px`,
        }}>
        <a href="/inks" style={{color: COLORS.textMuted, textDecoration: 'none'}}>
          Inks
        </a>
        <span style={{fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textDim}}>/</span>
        <span style={{color: COLORS.text, fontWeight: 500}}>{ink}</span>
      </nav>

      <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: accentBorder,
            flexShrink: 0,
          }}
        />
        <h1
          style={{
            fontSize: `${FONT_SIZES.xxl}px`,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
          }}>
          {ink} Cards
        </h1>
      </div>

      {/* The blurb is the page's indexable prose. Rendered as a real <p>, not a tooltip
          or a collapsed panel, so it counts as content rather than chrome. */}
      <p
        style={{
          marginTop: `${SPACING.sm}px`,
          marginBottom: `${SPACING.xl}px`,
          maxWidth: 720,
          fontSize: `${FONT_SIZES.lg}px`,
          lineHeight: 1.6,
          color: COLORS.textMuted,
        }}>
        {blurb}
      </p>
    </>
  );
}
