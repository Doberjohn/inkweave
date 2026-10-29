import {useFinePointer} from 'inkweave-ui/hooks/useFinePointer';
import {useResponsive} from 'inkweave-ui/hooks/useResponsive';
import {CtaButton} from '../../shared/components';
import {COLORS, DIALOG_BODY, DIALOG_TITLE, FONT_SIZES, RADIUS, SPACING, SURFACE_CARD} from '../../shared/constants';

/** The note's widest on a spread's cover, which it sits in the middle of; a phone's page is narrower. */
const NOTE_MAX_WIDTH = 320;

/**
 * What the binder's inside front cover says while the reader's collection holds no copies: that
 * it is empty, how a first copy goes in, and the import for a player who has a Dreamborn export.
 * On a spread it fills the front cover, in its middle; on a phone it sits at the cover's top,
 * above the collection's numbers, and the binder opens there while it shows.
 *
 * How a copy goes in follows the pointer, not the screen: a mouse points at a pocket and its − and
 * + open (`CollectionSlotCounts`), and a touch opens the card's window, whose copies stripe has
 * them (`WindowCopies`). A tablet's spread is touched.
 */
export function EmptyBinderNote({onImport}: {onImport: () => void}) {
  const {isMobile} = useResponsive();
  const pointing = useFinePointer();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: isMobile ? 'flex-start' : 'center',
        height: isMobile ? undefined : '100%',
        padding: isMobile ? `${SPACING.lg}px ${SPACING.lg}px 0` : SPACING.xl,
      }}>
      <div
        style={{
          ...SURFACE_CARD,
          background: COLORS.surfaceOverlay,
          borderRadius: RADIUS.lg,
          padding: isMobile ? SPACING.lg : SPACING.xl,
          maxWidth: isMobile ? undefined : NOTE_MAX_WIDTH,
          width: isMobile ? '100%' : undefined,
          textAlign: 'center',
        }}>
        <h2 style={{...DIALOG_TITLE, fontSize: FONT_SIZES.xl}}>Your binder is empty</h2>
        <p style={{...DIALOG_BODY, fontWeight: 400, marginTop: SPACING.sm}}>
          {pointing ? 'Point at a card and press + to add a copy.' : 'Tap a card, then + to add a copy.'} Your binder
          saves to your account as you go.
        </p>
        <CtaButton variant="ghost" onClick={onImport} style={{marginTop: SPACING.lg, width: '100%'}}>
          Import from Dreamborn
        </CtaButton>
      </div>
    </div>
  );
}
