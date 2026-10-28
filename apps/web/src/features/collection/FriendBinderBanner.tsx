import {CtaButton} from '../../shared/components';
import {CAP_LABEL_XS, COLORS, FONT_SIZES, RADIUS, SPACING, TRUNCATE} from '../../shared/constants';
import {FriendChip} from '../friends/FriendChip';

/** Where the banner's way back goes: your own binder, or Browse for a reader with no collection. */
export type FriendBinderBack = 'yours' | 'browse';

export interface FriendBinderBannerProps {
  isMobile: boolean;
  /** Their public name, once known; null while it loads, or for a handle no one has. */
  name: string | null;
  handle: string;
  /** Their binder is on show, read only; false while it loads or when they don't share. */
  shown: boolean;
  /** How many of their cards you need, for a reader who holds a collection: the phone's line. */
  youNeed: number | null;
  back: FriendBinderBack;
  onBack: () => void;
}

/** Whose binder, in words: their name, or their handle until it is known. */
const whose = (name: string | null, handle: string) => `${name ?? `@${handle}`}'s binder`;

const BACK_WORDS: Record<FriendBinderBack, {desktop: string; phone: string}> = {
  yours: {desktop: 'Back to your binder', phone: 'Yours'},
  browse: {desktop: 'Back to browse', phone: 'Browse'},
};

const READ_ONLY: React.CSSProperties = {
  ...CAP_LABEL_XS,
  flexShrink: 0,
  color: COLORS.textMuted,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: `${RADIUS.pill}px`,
  padding: `${SPACING.xxs}px ${SPACING.sm}px`,
  lineHeight: 1.2,
};

const MUTED: React.CSSProperties = {color: COLORS.textMuted, fontSize: `${FONT_SIZES.md}px`};

/**
 * A friend's binder's banner (#1045), above Browse's toolbar where its title sits: whose binder
 * it is, that it is read only, and the way back. On a phone it is two lines beside the chip,
 * the second saying how many of their cards you need. Names stay out of PostHog (#827).
 */
export function FriendBinderBanner(props: FriendBinderBannerProps) {
  return props.isMobile ? <PhoneBanner {...props} /> : <DesktopBanner {...props} />;
}

function BackButton({back, onBack, isMobile}: Pick<FriendBinderBannerProps, 'back' | 'onBack' | 'isMobile'>) {
  return (
    <CtaButton variant="neutral" onClick={onBack} style={{flexShrink: 0, marginLeft: 'auto'}}>
      <span aria-hidden="true">&lsaquo;</span>
      {BACK_WORDS[back][isMobile ? 'phone' : 'desktop']}
    </CtaButton>
  );
}

function DesktopBanner({name, handle, shown, back, onBack}: FriendBinderBannerProps) {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.md, minWidth: 0}}>
      <FriendChip name={name ?? handle} handle={handle} size="lg" />
      <h2
        className="ph-no-capture"
        style={{...TRUNCATE, margin: 0, color: COLORS.text, fontSize: `${FONT_SIZES.xxl}px`, fontWeight: 700}}>
        {whose(name, handle)}
      </h2>
      {name !== null && (
        <span className="ph-no-capture" style={{...MUTED, fontSize: `${FONT_SIZES.lg}px`}}>
          @{handle}
        </span>
      )}
      {shown && <span style={READ_ONLY}>Read only</span>}
      <BackButton back={back} onBack={onBack} isMobile={false} />
    </div>
  );
}

function PhoneBanner({name, handle, shown, youNeed, back, onBack}: FriendBinderBannerProps) {
  const detail = shown ? ['Read only', ...(youNeed === null ? [] : [`you need ${youNeed} of theirs`])].join(' · ') : null;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.md, minWidth: 0}}>
      <FriendChip name={name ?? handle} handle={handle} size="lg" />
      <div style={{display: 'flex', flexDirection: 'column', minWidth: 0}}>
        <h2
          className="ph-no-capture"
          style={{...TRUNCATE, margin: 0, color: COLORS.text, fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700}}>
          {whose(name, handle)}
        </h2>
        {detail && <span style={{...MUTED, ...TRUNCATE}}>{detail}</span>}
      </div>
      <BackButton back={back} onBack={onBack} isMobile />
    </div>
  );
}

/**
 * In the binder's place when the friend doesn't share with the reader: not a friend, a request
 * still waiting, the switch off, or no such handle, which all read the same, so a stranger
 * learns nothing. The banner above it holds the way back.
 */
export function FriendNotSharing({name, handle}: {name: string | null; handle: string}) {
  return (
    <p
      role="status"
      className="ph-no-capture"
      style={{textAlign: 'center', padding: `${SPACING.xxxl}px ${SPACING.lg}px`, margin: 0, ...MUTED, fontSize: `${FONT_SIZES.xl}px`}}>
      {`${name ?? `@${handle}`} doesn't share their collection with you.`}
    </p>
  );
}
