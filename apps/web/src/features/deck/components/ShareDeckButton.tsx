import {useEffect, useState} from 'react';
import {CtaButton} from '../../../shared/components';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import type {Deck} from '../types';

/**
 * How long the "Copied" confirmation stays up. Deliberately a named constant
 * rather than a DURATION token: this is a reading time, not a motion curve, and
 * the scale is three steps of animation timing.
 */
const COPIED_VISIBLE_MS = 2000;

/**
 * Why the button is inert, following the QuantityStepper convention the Duels and
 * Save buttons already use: a disabled button's `title` is not reliably announced,
 * so the same string rides `aria-label`.
 *
 * No positional wording ("below", "on the right"): this component does not own
 * the layout it sits in, and the visibility control could move.
 */
const PRIVATE_REASON = 'Only a public deck has a link to share. Make this deck public first.';

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

type ShareState = 'idle' | 'copied' | 'copy-failed';

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
 * What just happened, in words. `role` differs by kind: the confirmation is a
 * polite status, the failure is an assertive alert, because a reader who believes
 * they copied a link will not look back at this line.
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

/**
 * Copies `/decks/:id` to the clipboard, and does nothing else (owner ruling
 * 2026-08-05).
 *
 * A private deck's link resolves to nothing for everyone but its owner, so this
 * REFUSES to copy one: the button is disabled and says why. It used to offer to
 * publish first, which made this the one place a deck could become public as a
 * side effect of wanting a link. Publishing is now only ever chosen outright,
 * either as the visibility picked when the deck is created (that choice reaches
 * the row on the next Save, with no separate publish step) or through the
 * visibility control on this page.
 *
 * Non-owners never see the disabled state: RLS means a private deck returns no
 * row, so any deck a stranger is looking at is public by definition.
 *
 * Filled, not ghost: on `/decks/:id` this is the payoff, and the owner controls
 * beside it are deliberately quieter.
 */
export function ShareDeckButton({deck}: {deck: Deck}) {
  const [state, setState] = useState<ShareState>('idle');
  const url = deckUrl(deck.id);
  const isPublic = Boolean(deck.isPublic);

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

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: SPACING.sm}}>
      <CtaButton
        variant="filled"
        onClick={() => void copyNow()}
        disabled={!isPublic}
        title={isPublic ? undefined : PRIVATE_REASON}
        aria-label={isPublic ? undefined : PRIVATE_REASON}>
        <ShareIcon />
        Copy link
      </CtaButton>
      <ShareNotice state={state} url={url} />
    </div>
  );
}
