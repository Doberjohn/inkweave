import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import type {Ink} from 'inkweave-synergy-engine';
import {COLORS, Z_INDEX} from '../../../shared/constants';

interface MobileLightboxProps {
  imageUrl: string;
  alt: string;
  /** Card's primary ink — drives the border + glow tint. */
  ink: Ink;
  /**
   * Bounding rect of the card tile that opened this lightbox. Drives the FLIP reveal — the
   * enlarged card animates FROM this rect TO its centered position on open, and back TO it on
   * close. Null skips both FLIPs (card just appears / disappears).
   */
  originRect: DOMRect | null;
  /** Called once the close (reverse-FLIP) animation finishes — the parent then unmounts this. */
  onClose: () => void;
}

const FLIP_DURATION_MS = 340;
const FLIP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
/** Chrome (scrim + close button + caption) fades slightly faster than the card FLIP. */
const CHROME_FADE_MS = 240;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Resolves the FLIP context — the card element plus its origin rect — or null when a FLIP
 * can't run (missing element/rect, or reduced motion). Returning the narrowed pair lets callers
 * guard with a single `if (!ctx) return` instead of a three-term compound conditional.
 */
function flipContext(
  el: HTMLElement | null,
  originRect: DOMRect | null,
): {el: HTMLElement; originRect: DOMRect} | null {
  if (!el || !originRect) return null;
  if (prefersReducedMotion()) return null;
  return {el, originRect};
}

/**
 * Mobile-only enlarged card preview. Portals to document.body so it can render the card at its
 * native 367px width without the modal's bounds clipping it.
 *
 * Reveal + dismiss are symmetric FLIPs from/to the originating tile (#332 #5): on open the card
 * grows from the tapped tile's rect into the centered lightbox; on close it shrinks back into
 * the tile. The component owns its exit animation — `requestClose` plays the reverse FLIP and
 * only calls `onClose` (which unmounts it) once that finishes.
 *
 * Distinct from {@link CardLightbox}: portal-to-body + ink-tinted border/glow + FLIP reveal +
 * visible "Tap anywhere to close" caption.
 *
 * Dismiss paths: tap the scrim, tap the × button, press Escape.
 */
export function MobileLightbox({imageUrl, alt, ink, originRect, onClose}: MobileLightboxProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Holds the in-flight FLIP animation (entry or exit). Cancelled before starting a new one so
  // two animations never compete on `transform` — see the entry-FLIP comment for the StrictMode
  // double-invoke rationale.
  const flipRef = useRef<Animation | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Entry FLIP — card animates FROM the origin tile's rect TO its centered destination via the
  // Web Animations API. `transformOrigin: top-left` makes translate + scale compose into a
  // corner-anchored FLIP. The cleanup `cancel()` is load-bearing: React StrictMode runs this
  // layoutEffect twice (effect → cleanup → effect); without it, two stacked animations compete
  // on `transform` and neither applies.
  useLayoutEffect(() => {
    const ctx = flipContext(cardRef.current, originRect);
    if (!ctx) return;
    const {el} = ctx;
    const dest = el.getBoundingClientRect();
    if (dest.width === 0) return;
    const {dx, dy, scale} = flipDeltas(ctx.originRect, dest);
    el.style.transformOrigin = 'top left';
    const anim = el.animate(
      [
        {transform: `translate(${dx}px, ${dy}px) scale(${scale})`},
        {transform: 'translate(0px, 0px) scale(1)'},
      ],
      {duration: FLIP_DURATION_MS, easing: FLIP_EASING},
    );
    flipRef.current = anim;
    return () => anim.cancel();
  }, [originRect]);

  // Reverse FLIP — card shrinks back into the origin tile, then `onClose` unmounts the lightbox.
  const requestClose = useCallback(() => {
    const ctx = flipContext(cardRef.current, originRect);
    if (!ctx) {
      onClose();
      return;
    }
    const {el} = ctx;
    setIsClosing(true); // fades the scrim + close button + caption out
    // Cancel any in-flight entry FLIP so the exit animation is the only one on `transform`.
    flipRef.current?.cancel();
    const dest = el.getBoundingClientRect();
    const {dx, dy, scale} = flipDeltas(ctx.originRect, dest);
    el.style.transformOrigin = 'top left';
    const anim = el.animate(
      [
        {transform: 'translate(0px, 0px) scale(1)'},
        {transform: `translate(${dx}px, ${dy}px) scale(${scale})`},
      ],
      // `fill: forwards` holds the card at the shrunken rect after the animation finishes, so it
      // doesn't snap back to full size for a frame before `onClose` unmounts it.
      {duration: FLIP_DURATION_MS, easing: FLIP_EASING, fill: 'forwards'},
    );
    flipRef.current = anim;
    anim.onfinish = onClose;
  }, [originRect, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestClose]);

  const tint = INK_LIGHTBOX_TINT[ink];
  // Chrome fades out on close; the card itself does the FLIP, not a fade.
  const chromeStyle: React.CSSProperties = {
    opacity: isClosing ? 0 : 1,
    transition: `opacity ${CHROME_FADE_MS}ms ease-out`,
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Enlarged: ${alt}`} style={ROOT_STYLE}>
      <div
        className="mobile-lightbox-scrim"
        onClick={requestClose}
        aria-hidden="true"
        style={{...SCRIM_STYLE, ...chromeStyle}}
      />
      <button
        type="button"
        aria-label="Close enlarged card"
        onClick={requestClose}
        style={{...CLOSE_BUTTON_STYLE, ...chromeStyle}}>
        ×
      </button>
      <div
        ref={cardRef}
        style={{
          ...CARD_STYLE,
          border: `2px solid ${tint.border}`,
          boxShadow: `0 0 36px ${tint.glow}, 0 24px 60px rgba(0, 0, 0, 0.8)`,
        }}>
        <img src={imageUrl} alt={alt} style={IMG_STYLE} />
      </div>
      <p style={{...CAPTION_STYLE, ...chromeStyle}}>Tap anywhere to close</p>
    </div>,
    document.body,
  );
}

/** Translate + uniform-scale deltas to FLIP a centered card to/from the origin tile's rect. */
function flipDeltas(origin: DOMRect, dest: DOMRect): {dx: number; dy: number; scale: number} {
  return {
    dx: origin.left - dest.left,
    dy: origin.top - dest.top,
    scale: origin.width / dest.width,
  };
}

/** Per-ink border + glow tint pair. Border at 0.7 alpha for the solid edge; glow at 0.35 for the soft halo. */
const INK_LIGHTBOX_TINT: Record<Ink, {border: string; glow: string}> = {
  Amber:    {border: 'rgba(245, 178, 2, 0.7)',  glow: 'rgba(245, 178, 2, 0.35)'},
  Amethyst: {border: 'rgba(139, 92, 246, 0.7)', glow: 'rgba(139, 92, 246, 0.35)'},
  Emerald:  {border: 'rgba(16, 185, 129, 0.7)', glow: 'rgba(16, 185, 129, 0.35)'},
  Ruby:     {border: 'rgba(239, 68, 68, 0.7)',  glow: 'rgba(239, 68, 68, 0.35)'},
  Sapphire: {border: 'rgba(59, 130, 246, 0.7)', glow: 'rgba(59, 130, 246, 0.35)'},
  Steel:    {border: 'rgba(107, 114, 128, 0.7)', glow: 'rgba(107, 114, 128, 0.35)'},
};

const ROOT_STYLE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  // Sits above the modal (Z_INDEX.modal = 1000) and modal backdrop, below popovers.
  zIndex: Z_INDEX.popoverBackdrop,
  // Flex-center the card so the FLIP transform is the ONLY transform on it — no centering
  // translate to compose with / fight against.
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const SCRIM_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.78)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  cursor: 'zoom-out',
};

const CARD_STYLE: React.CSSProperties = {
  position: 'relative',
  // Native source AVIF width — show at 1:1 native resolution (no upscale/downscale artifacts).
  // 367 fits on every modern phone (iPhone SE = 375 logical px is the narrowest mainstream).
  width: 367,
  aspectRatio: '264 / 368',
  borderRadius: 18,
  overflow: 'hidden',
  zIndex: 11,
};

const IMG_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 18,
  right: 18,
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: 'rgba(13, 13, 20, 0.8)',
  border: `1px solid ${COLORS.surfaceBorder}`,
  color: COLORS.text,
  fontSize: 22,
  fontFamily: 'Arial, sans-serif',
  lineHeight: 1,
  zIndex: 12,
  cursor: 'pointer',
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const CAPTION_STYLE: React.CSSProperties = {
  position: 'absolute',
  bottom: 32,
  left: 0,
  right: 0,
  textAlign: 'center',
  color: COLORS.textMuted,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  zIndex: 12,
  pointerEvents: 'none',
  margin: 0,
};

// The scrim fade-in keyframe (`mobile-lightbox-fade-in`) lives in index.css so it participates
// in the prefers-reduced-motion override. Card reveal + dismiss are JS FLIPs (also
// reduced-motion-guarded); the chrome fade-out is an inline opacity transition.
