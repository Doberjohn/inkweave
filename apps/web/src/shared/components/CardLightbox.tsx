import {useState} from 'react';
import {COLORS, FONT_SIZES, RADIUS, hexRgba} from '../constants';
import {DialogShell} from './DialogShell';

interface CardLightboxProps {
  src: string;
  alt: string;
  isLocation?: boolean;
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

/**
 * Fullscreen lightbox overlay for enlarged card images, riding DialogShell
 * (#510) on the `lightbox` layer so it clears an open card modal. Dismiss via
 * backdrop click or Escape; gains the focus trap + restore it never had.
 */
export function CardLightbox({src, alt, isLocation, onClose}: CardLightboxProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <DialogShell
      isOpen
      onClose={onClose}
      ariaLabel={`Enlarged view of ${alt}`}
      scrim="heavy"
      layer="lightbox"
      panelStyle={BARE_PANEL}>
      {imgError ? (
        <div
          style={{
            padding: '40px 32px',
            background: COLORS.surface,
            borderRadius: `${RADIUS.xl}px`,
            border: `2px solid ${COLORS.primary500}`,
            textAlign: 'center',
          }}>
          <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.base}px`, margin: 0}}>
            Image could not be loaded
          </p>
          <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`, margin: '8px 0 0'}}>
            Click anywhere to close
          </p>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onError={() => setImgError(true)}
          style={{
            display: 'block',
            margin: '0 auto',
            maxWidth: isLocation ? '85vh' : 'calc(100vw - 80px)',
            maxHeight: isLocation ? 'calc(100vw - 80px)' : '85vh',
            borderRadius: `${RADIUS.xl}px`,
            border: `2px solid ${COLORS.primary500}`,
            boxShadow: `0 0 30px ${hexRgba(COLORS.primary500, 0.3)}`,
            objectFit: 'contain',
            transform: isLocation ? 'rotate(90deg)' : undefined,
          }}
        />
      )}
    </DialogShell>
  );
}
