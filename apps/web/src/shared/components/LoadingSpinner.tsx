import {COLORS, FONT_SIZES} from '../constants';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({
  message = 'Loading cards from LorcanaJSON...',
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '16px',
      }}>
      <div
        style={{
          width: '48px',
          height: '48px',
          border: `4px solid ${COLORS.gray200}`,
          borderTopColor: COLORS.primary500,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p style={{color: COLORS.gray500, fontSize: `${FONT_SIZES.lg}px`}}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
