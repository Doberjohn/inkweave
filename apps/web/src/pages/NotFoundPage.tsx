import {useNavigate} from 'react-router-dom';
import {COLORS, FONTS} from '../shared/constants';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        fontFamily: FONTS.body,
      }}>
      <h2 style={{color: COLORS.text, margin: 0}}>Page not found</h2>
      <p style={{color: COLORS.textMuted, margin: 0}}>
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          padding: '10px 20px',
          background: COLORS.primary500,
          color: COLORS.white,
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 500,
        }}>
        Go Home
      </button>
    </main>
  );
}
