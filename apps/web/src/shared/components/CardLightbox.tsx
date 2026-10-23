import {useState} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONT_SIZES, RADIUS, SHADOWS, SPACING} from '../constants';
import {CardTranslationPanel} from './CardTranslationPanel';
import {CardTranslationToggle} from './CardTranslationToggle';
import {DialogShell} from './DialogShell';
import {InkCardPlaceholder} from './InkCardPlaceholder';

interface CardLightboxProps {
  src: string;
  alt: string;
  isLocation?: boolean;
  /**
   * The card shown. When the scan is not in English (`language`), a "See translation" toggle
   * lays its English name and text over the scan.
   */
  card?: LorcanaCard;
  /**
   * The scan's language: a variant printing's own (#681), by default the card's. A host showing
   * an English printing of a foreign card passes no `card`, since an explicit undefined here
   * also falls back to the card's language.
   */
  language?: string;
  /**
   * The card's inks, which tint the placeholder shown until the scan loads. Left out, as for a
   * waiting promo whose card isn't in the data yet, it is the neutral tile.
   */
  ink?: Ink;
  ink2?: Ink;
  onClose: () => void;
}

/** Panel chrome neutralized: the lightbox "panel" is the free-floating image itself. */
const BARE_PANEL: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  boxShadow: 'none',
  width: 'auto',
  maxWidth: 'none',
  maxHeight: 'none',
  overflow: 'visible',
};

/** The image's border width: the translation sits inside it, so the gold frame stays. */
const FRAME = 2;

/**
 * Covers the scan's layout box, so toggling never shifts the layout. A Location's scan is
 * turned 90° by a transform, which that box ignores: the panel would stand upright over it.
 * No translated card is a Location yet.
 */
const OVER_SCAN: React.CSSProperties = {
  position: 'absolute',
  inset: FRAME,
  borderRadius: `${RADIUS.card}px`,
};

// The fallback's top and bottom padding, past the spacing scale's top step (SPACING.xxxl, 32).
const FALLBACK_PADDING_BLOCK = 40;

function ImageFallback() {
  return (
    <div
      style={{
        padding: `${FALLBACK_PADDING_BLOCK}px ${SPACING.xxxl}px`,
        background: COLORS.surface,
        borderRadius: `${RADIUS.xl}px`,
        border: `${FRAME}px solid ${COLORS.primary}`,
        textAlign: 'center',
      }}>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`, margin: 0}}>
        Image could not be loaded
      </p>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`, margin: `${SPACING.sm}px 0 0`}}>
        Click anywhere to close
      </p>
    </div>
  );
}

/** Every scan is 337 x 470, as production serves it: its frame's size, the frame included. */
const SCAN_WIDTH = 337 + 2 * FRAME;
const SCAN_RATIO = `${SCAN_WIDTH} / ${470 + 2 * FRAME}`;

/**
 * The scan's gold frame, the size the scan takes within the lightbox's bounds: 85vh tall, and
 * 80px narrower than the screen. It holds the card's ink placeholder, which shows until the
 * scan, laid over it, loads.
 */
const SCAN_FRAME: React.CSSProperties = {
  position: 'relative',
  margin: '0 auto',
  width: `min(${SCAN_WIDTH}px, calc(100vw - 80px), calc(85vh * ${SCAN_RATIO}))`,
  aspectRatio: SCAN_RATIO,
  borderRadius: `${RADIUS.xl}px`,
  border: `${FRAME}px solid ${COLORS.primary}`,
  boxShadow: SHADOWS.glowLg,
  overflow: 'hidden',
};

/** A Location's frame is turned 90°, so its bounds swap. */
const LOCATION_FRAME: React.CSSProperties = {
  ...SCAN_FRAME,
  width: `min(${SCAN_WIDTH}px, 85vh, calc((100vw - 80px) * ${SCAN_RATIO}))`,
  transform: 'rotate(90deg)',
};

const SCAN: React.CSSProperties = {
  position: 'relative',
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};

interface EnlargedScanProps {
  src: string;
  alt: string;
  isLocation?: boolean;
  ink?: Ink;
  ink2?: Ink;
  onError: () => void;
}

/** The enlarged scan, framed in gold, over the card's ink placeholder until it loads. */
function EnlargedScan({src, alt, isLocation, ink, ink2, onError}: EnlargedScanProps) {
  return (
    <div style={isLocation ? LOCATION_FRAME : SCAN_FRAME}>
      <InkCardPlaceholder ink={ink} ink2={ink2} />
      <img src={src} alt={alt} onError={onError} style={SCAN} />
    </div>
  );
}

/**
 * Fullscreen lightbox overlay for enlarged card images, riding DialogShell
 * (#510) on the `lightbox` layer so it clears an open card modal. Dismiss via
 * backdrop click or Escape; gains the focus trap + restore it never had.
 */
export function CardLightbox({
  src,
  alt,
  isLocation,
  card,
  language = card?.scanLanguage,
  ink,
  ink2,
  onClose,
}: CardLightboxProps) {
  const [imgError, setImgError] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <DialogShell
      isOpen
      onClose={onClose}
      ariaLabel={`Enlarged view of ${alt}`}
      scrim="heavy"
      layer="lightbox"
      // Opts out of the shell's × (owner, 2026-10-23): it would sit on the card's art, and a
      // tap anywhere outside the card already closes the lightbox.
      showClose={false}
      panelStyle={BARE_PANEL}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.md}}>
        <div style={{position: 'relative'}}>
          {imgError ? (
            <ImageFallback />
          ) : (
            <EnlargedScan
              src={src}
              alt={alt}
              isLocation={isLocation}
              ink={ink}
              ink2={ink2}
              onError={() => setImgError(true)}
            />
          )}
          {/* Without a scan to cover, the translation stands below the fallback instead. */}
          {showTranslation && card && (
            <CardTranslationPanel
              card={card}
              language={language}
              style={imgError ? undefined : OVER_SCAN}
            />
          )}
        </div>
        {card && language && (
          <CardTranslationToggle shown={showTranslation} onToggle={() => setShowTranslation((shown) => !shown)} />
        )}
      </div>
    </DialogShell>
  );
}
