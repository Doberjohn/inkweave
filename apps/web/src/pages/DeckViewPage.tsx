import {useParams} from 'react-router-dom';
import {CompactHeader} from '../shared/components';
import {useResponsive} from '../shared/hooks';
import {COLORS, FONTS, LAYOUT, SPACING} from '../shared/constants';

/**
 * `/decks/:id` — read-only deck view (public or owner). Fills in with sharing (#473) and
 * the social phase; this is the scaffold shell (#466).
 */
export function DeckViewPage() {
  const {id} = useParams();
  const {isMobile} = useResponsive();
  return (
    <>
      <CompactHeader isMobile={isMobile} />
      <main
        style={{
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          background: COLORS.background,
          padding: SPACING.xl,
          maxWidth: 900,
          margin: '0 auto',
        }}>
        <h1 style={{fontFamily: FONTS.hero, fontSize: 20, color: COLORS.text, margin: 0}}>Deck</h1>
        <p style={{fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm}}>
          Viewing deck {id}. The read-only view arrives with sharing (#473).
        </p>
      </main>
    </>
  );
}
