import {Link, useNavigate} from 'react-router-dom';
import {INK_HUBS, cardsForInk} from '../features/cards';
import {CompactHeader, EtherealBackground, Seo} from '../shared/components';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING} from '../shared/constants';

/**
 * `/inks` — index of the six ink hub pages (#530).
 *
 * Gives the hubs a parent, so the footer needs one link target rather than six competing
 * ones, and so each hub's breadcrumb resolves. Small page, but it is what makes the hub
 * set navigable as a group rather than six unrelated URLs.
 */
export function InkGalleryPage() {
  const navigate = useNavigate();
  const {cards, isLoading} = useCardDataContext();

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
        title="Disney Lorcana Cards by Ink | Inkweave"
        description="Browse every Disney Lorcana Core-format card by ink — Amber, Amethyst, Emerald, Ruby, Sapphire and Steel — with what each ink does and the cards that define it."
        canonicalPath="/inks"
      />
      <EtherealBackground />
      <CompactHeader onLogoClick={() => navigate('/')} />

      <div
        style={{
          flex: 1,
          position: 'relative',
          zIndex: 1,
          padding: `${SPACING.xl}px`,
          maxWidth: 1080,
          width: '100%',
          margin: '0 auto',
        }}>
        <h1
          style={{
            fontSize: `${FONT_SIZES.xxl}px`,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
          }}>
          Cards by Ink
        </h1>
        <p
          style={{
            marginTop: `${SPACING.sm}px`,
            marginBottom: `${SPACING.xl}px`,
            maxWidth: 720,
            fontSize: `${FONT_SIZES.lg}px`,
            lineHeight: 1.6,
            color: COLORS.textMuted,
          }}>
          Every Lorcana card belongs to at least one of six inks, and each plays differently.
          Pick an ink to see every Core-format card in it, or read what defines it below.
        </p>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: `${SPACING.md}px`,
          }}>
          {INK_HUBS.map((hub) => (
            <li key={hub.slug}>
              <Link
                to={`/ink/${hub.slug}`}
                style={{
                  display: 'block',
                  height: '100%',
                  padding: `${SPACING.lg}px`,
                  borderRadius: RADIUS.card,
                  border: `1px solid ${INK_COLORS[hub.ink].border}`,
                  background: COLORS.surface,
                  textDecoration: 'none',
                }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: `${FONT_SIZES.xl}px`,
                    fontWeight: 700,
                    color: COLORS.text,
                    marginBottom: `${SPACING.xs}px`,
                  }}>
                  {hub.ink}
                </span>
                {/* Counts derive from the same helper the hubs use, so the index can never
                    advertise a number the hub does not deliver. */}
                <span
                  style={{
                    display: 'block',
                    fontSize: `${FONT_SIZES.xs}px`,
                    color: COLORS.textDim,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: `${SPACING.sm}px`,
                  }}>
                  {isLoading ? ' ' : `${cardsForInk(cards, hub.ink).length} cards`}
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: `${FONT_SIZES.sm}px`,
                    lineHeight: 1.55,
                    color: COLORS.textMuted,
                  }}>
                  {hub.blurb}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
