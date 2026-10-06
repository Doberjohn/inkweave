import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONT_SIZES, RADIUS, SPACING, hexRgba} from '../constants';
import {CardTranslationPanel} from './CardTranslationPanel';
import {CardTranslationToggle} from './CardTranslationToggle';
import {DialogShell} from './DialogShell';

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

function ImageFallback() {
  return (
    <div
      style={{
        padding: '40px 32px',
        background: COLORS.surface,
        borderRadius: `${RADIUS.xl}px`,
        border: `${FRAME}px solid ${COLORS.primary500}`,
        textAlign: 'center',
      }}>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`, margin: 0}}>
        Image could not be loaded
      </p>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`, margin: '8px 0 0'}}>
        Click anywhere to close
      </p>
    </div>
  );
}

/** The enlarged scan, framed in gold. A Location's is turned 90°, so its size bounds swap. */
function EnlargedScan({src, alt, isLocation, onError}: {src: string; alt: string; isLocation?: boolean; onError: () => void}) {
  return (
    <img
      src={src}
      alt={alt}
      onError={onError}
      style={{
        display: 'block',
        margin: '0 auto',
        maxWidth: isLocation ? '85vh' : 'calc(100vw - 80px)',
        maxHeight: isLocation ? 'calc(100vw - 80px)' : '85vh',
        borderRadius: `${RADIUS.xl}px`,
        border: `${FRAME}px solid ${COLORS.primary500}`,
        boxShadow: `0 0 30px ${hexRgba(COLORS.primary500, 0.3)}`,
        objectFit: 'contain',
        transform: isLocation ? 'rotate(90deg)' : undefined,
      }}
    />
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
      panelStyle={BARE_PANEL}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.md}}>
        <div style={{position: 'relative'}}>
          {imgError ? (
            <ImageFallback />
          ) : (
            <EnlargedScan src={src} alt={alt} isLocation={isLocation} onError={() => setImgError(true)} />
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
