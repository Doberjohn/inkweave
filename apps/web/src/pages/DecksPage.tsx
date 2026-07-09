import {Link} from 'react-router-dom';
import {COLORS, FONTS, SPACING} from '../shared/constants';

/**
 * `/decks` — the user's deck list. Local drafts and cloud decks fill in with #473/#464;
 * this is the scaffold shell (#466).
 */
export function DecksPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        padding: SPACING.xl,
        maxWidth: 900,
        margin: '0 auto',
      }}>
      <h1 style={{fontFamily: FONTS.hero, fontSize: 20, color: COLORS.text, margin: 0}}>Your Decks</h1>
      <p style={{fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm}}>
        Build a Core-legal deck with live synergy guidance.
      </p>
      <Link
        to="/decks/new"
        style={{
          display: 'inline-block',
          marginTop: SPACING.lg,
          padding: `${SPACING.sm}px ${SPACING.lg}px`,
          background: COLORS.primary,
          color: COLORS.background,
          fontFamily: FONTS.body,
          fontSize: 14,
          fontWeight: 600,
          borderRadius: 10,
          textDecoration: 'none',
        }}>
        + New deck
      </Link>
    </main>
  );
}
