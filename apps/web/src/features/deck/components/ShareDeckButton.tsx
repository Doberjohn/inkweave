import {useEffect, useState} from 'react';
import {CtaButton} from '../../../shared/components';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../../shared/constants';
import type {Deck} from '../types';

/**
 * How long the "Copied" confirmation stays up. Deliberately a named constant
 * rather than a DURATION token: this is a reading time, not a motion curve, and
 * the scale is three steps of animation timing.
 */
const COPIED_VISIBLE_MS = 2000;

/** The deck's public address. Same shape the router serves at `/decks/:id`. */
function deckUrl(deckId: string): string {
  return `${window.location.origin}/decks/${deckId}`;
}

/**
 * Writes to the clipboard, reporting whether it actually landed.
 *
 * `navigator.clipboard` is undefined outside a secure context and its write
 * rejects without permission, so both failures arrive here. Neither may be
 * reported as a copy: the reader would paste the wrong thing and never know.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * `working` covers the publish round trip. The three terminal states are kept
 * apart because they need different words: a copy that failed still has a link
 * to hand over, a publish that failed has nothing to share yet.
 */
type ShareState = 'idle' | 'confirming' | 'working' | 'copied' | 'copy-failed' | 'publish-failed';

interface ShareDeckButtonProps {
  deck: Deck;
  /**
   * Publishes the deck, resolving true when the write landed. Supplied only by
   * the owner: nobody else may publish, and RLS means nobody else ever sees a
   * private deck to want to.
   */
  onPublish?: () => Promise<boolean>;
}

/** Arrow leaving a tray: the mirrored import glyph, and the house share mark. */
function ShareIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 16V4m0 0L8 8m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The offer, never the act. Sharing a link and publishing to a community feed
 * are different intentions, so a private deck states what publishing would mean
 * and waits: copying a link that silently made the deck public would be a
 * decision taken on the owner's behalf.
 */
function PublishPrompt({onConfirm, onCancel}: {onConfirm: () => void; onCancel: () => void}) {
  return (
    <div
      style={{
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: `${RADIUS.lg}px`,
        padding: SPACING.md,
        maxWidth: 420,
      }}>
      <p
        style={{
          margin: 0,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
          lineHeight: 1.6,
          color: COLORS.text,
        }}>
        This deck is private, so a link to it shows nothing to anyone else. Publishing it means anyone can see the
        deck, and it appears in community decks.
      </p>
      <div style={{display: 'flex', gap: SPACING.sm, marginTop: SPACING.md, flexWrap: 'wrap'}}>
        <CtaButton variant="neutral" onClick={onCancel}>
          Keep it private
        </CtaButton>
        <CtaButton variant="filled" onClick={onConfirm}>
          Publish and copy link
        </CtaButton>
      </div>
    </div>
  );
}

/**
 * What just happened, in words. `role` differs by kind: the confirmation is a
 * polite status, the two failures are assertive alerts, because a reader who
 * believes they copied a link will not look back at this line.
 */
function ShareNotice({state, url}: {state: ShareState; url: string}) {
  if (state === 'copied') {
    return (
      <p
        role="status"
        style={{
          margin: 0,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
          fontWeight: 600,
          color: COLORS.primary,
        }}>
        ✓ Copied
      </p>
    );
  }

  if (state === 'publish-failed') {
    return (
      <p
        role="alert"
        style={{margin: 0, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`, color: COLORS.error}}>
        Could not publish the deck. It is still private and nothing was copied. Try again in a moment.
      </p>
    );
  }

  if (state === 'copy-failed') {
    return (
      <p
        role="alert"
        style={{
          margin: 0,
          maxWidth: 420,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.base}px`,
          lineHeight: 1.6,
          color: COLORS.error,
        }}>
        Your browser would not let us reach the clipboard. The link is{' '}
        {/* The address itself, so a blocked clipboard costs a selection rather
            than the whole share. wordBreak: a deck id does not wrap on its own. */}
        <span style={{color: COLORS.text, wordBreak: 'break-all', userSelect: 'all'}}>{url}</span>
      </p>
    );
  }

  return null;
}

/** Label for the resting button: the publish round trip is the only busy state. */
function shareLabel(working: boolean): string {
  return working ? 'Publishing…' : 'Copy link';
}

/**
 * Copies `/decks/:id` to the clipboard, and is the one place a deck becomes
 * public by accident, so it is the one place that refuses to (#473).
 *
 * A public deck copies straight away. A private deck the viewer OWNS is met
 * with the offer above, confirmed before anything is published or copied. A
 * private deck the viewer does not own cannot occur, since RLS returns no row.
 *
 * Filled, not ghost: on `/decks/:id` this is the payoff, and the owner controls
 * beside it are deliberately quieter.
 */
export function ShareDeckButton({deck, onPublish}: ShareDeckButtonProps) {
  const [state, setState] = useState<ShareState>('idle');
  const url = deckUrl(deck.id);

  // The confirmation is transient by design: it reports a moment, and a "Copied"
  // that never leaves stops describing the last press.
  useEffect(() => {
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), COPIED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const copyNow = async () => {
    setState((await copyToClipboard(url)) ? 'copied' : 'copy-failed');
  };

  const publishThenCopy = async () => {
    if (!onPublish) return;
    setState('working');
    // A failed publish stops here. Copying anyway would hand out a link that
    // resolves to nothing, which is the failure wearing the success's clothes.
    if (!(await onPublish())) {
      setState('publish-failed');
      return;
    }
    await copyNow();
  };

  const share = () => {
    if (!deck.isPublic && onPublish) {
      setState('confirming');
      return;
    }
    void copyNow();
  };

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: SPACING.sm}}>
      {state === 'confirming' ? (
        <PublishPrompt onConfirm={() => void publishThenCopy()} onCancel={() => setState('idle')} />
      ) : (
        <CtaButton variant="filled" onClick={share} disabled={state === 'working'}>
          <ShareIcon />
          {shareLabel(state === 'working')}
        </CtaButton>
      )}
      <ShareNotice state={state} url={url} />
    </div>
  );
}
