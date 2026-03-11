import {useState, useEffect, useCallback} from 'react';
import {createPortal} from 'react-dom';
import {COLORS, FONT_SIZES, RADIUS, Z_INDEX} from '../constants';
import {useScrollLock} from '../hooks';

interface CardLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/** Fullscreen lightbox overlay for enlarged card images. Dismiss via backdrop click or Escape. Locks body scroll while open.
 *  Renders via portal to document.body to escape transform-based stacking contexts (e.g. animated modals). */
export function CardLightbox({src, alt, onClose}: CardLightboxProps) {
  const [imgError, setImgError] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useScrollLock(true);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return createPortal(
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
            maxWidth: 'calc(100vw - 80px)',
            maxHeight: '85vh',
            borderRadius: `${RADIUS.xl}px`,
            border: `2px solid ${COLORS.primary500}`,
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)',
            cursor: 'default',
            objectFit: 'contain',
          }}
        />
      )}
    </div>,
    document.body,
  );
}
