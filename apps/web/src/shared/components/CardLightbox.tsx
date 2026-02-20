import {useState, useEffect, useCallback} from 'react';
import {COLORS, FONT_SIZES, RADIUS, Z_INDEX} from '../constants';

interface CardLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/** Fullscreen lightbox overlay for enlarged card images. Dismiss via backdrop click or Escape. Locks body scroll while open. */
export function CardLightbox({src, alt, onClose}: CardLightboxProps) {
  const [imgError, setImgError] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [handleKeyDown]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Enlarged view of ${alt}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z_INDEX.modal,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}>
      {imgError ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            padding: '40px 32px',
            background: COLORS.surface,
            borderRadius: `${RADIUS.xl}px`,
            border: `2px solid ${COLORS.primary500}`,
            textAlign: 'center',
            cursor: 'default',
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
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '90vw',
            maxHeight: '85vh',
            borderRadius: `${RADIUS.xl}px`,
            border: `2px solid ${COLORS.primary500}`,
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)',
            cursor: 'default',
            objectFit: 'contain',
          }}
        />
      )}
    </div>
  );
}
