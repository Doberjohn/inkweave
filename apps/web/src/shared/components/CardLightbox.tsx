import {useState, useEffect} from 'react';
import {createPortal} from 'react-dom';
import {COLORS, FONT_SIZES, RADIUS, Z_INDEX} from '../constants';
import {useScrollLock} from '../hooks';

interface CardLightboxProps {
  src: string;
  alt: string;
  isLocation?: boolean;
  onClose: () => void;
}

/** Fullscreen lightbox overlay for enlarged card images. Dismiss via backdrop click or Escape. Locks body scroll while open.
 *  Renders via portal to document.body to escape transform-based stacking contexts (e.g. animated modals). */
export function CardLightbox({src, alt, isLocation, onClose}: CardLightboxProps) {
  const [imgError, setImgError] = useState(false);

  useScrollLock(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop dismiss; Escape key handled via document listener
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
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- click interception to prevent backdrop dismiss; not interactive, just event boundary
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
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- click interception to prevent backdrop dismiss; not interactive, just event boundary
        <img
          src={src}
          alt={alt}
          onError={() => setImgError(true)}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: isLocation ? '85vh' : 'calc(100vw - 80px)',
            maxHeight: isLocation ? 'calc(100vw - 80px)' : '85vh',
            borderRadius: `${RADIUS.xl}px`,
            border: `2px solid ${COLORS.primary500}`,
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.3)',
            cursor: 'default',
            objectFit: 'contain',
            transform: isLocation ? 'rotate(90deg)' : undefined,
          }}
        />
      )}
    </div>,
    document.body,
  );
}
