import {useNavigate} from 'react-router-dom';
import {useSession} from '../contexts/SessionContext';
import {CtaButton} from './CtaButton';

interface AuthButtonProps {
  /** Opens the caller's SignInDialog. Only called when signed out. */
  onSignIn: () => void;
}

/**
 * The signed-out / signed-in header slot, without a dialog: "Sign in" when
 * signed out, a link to /account when signed in. Sign OUT lives on that page
 * (design doc 2026-08-11) — it is session-ending and rare, so it does not belong
 * one click from every screen.
 *
 * Two surfaces render this: the desktop header's rightmost slot (`HeaderAuth` in
 * CompactHeader) and `/decks` on mobile, where no header exists. It deliberately
 * does NOT own a `SignInDialog`, because `DecksPage` already renders one for
 * `NewDeckDialog`'s "keep both" link and a second would be a duplicate overlay.
 * Dialog ownership stays with the caller; only the button rule is shared.
 *
 * Renders NOTHING while `loading`, and that is the load-bearing part. `user` is
 * null during that window, so the naive version shows "Sign in" and then swaps to
 * "Account" once auth resolves: the wrong state, flashed on every page load for
 * every returning user. Also renders nothing when auth is not configured at all
 * (`enabled: false`), which is how the app degrades without Supabase env.
 */
export function AuthButton({onSignIn}: AuthButtonProps) {
  const {user, enabled, loading} = useSession();
  const navigate = useNavigate();

  if (!enabled || loading) return null;

  // Signed in, the slot is a DOOR to the account page, not a sign-out. Signing
  // out is session-ending and rare; it does not belong one click from every
  // screen, and the account surface otherwise has no entry point at all. Sign
  // out now lives on /account (design doc 2026-08-11).
  //
  // Labelled "Account" rather than the display name because this file is in
  // shared/ and the name comes from `useProfile`, a FEATURE — shared must not
  // import features. The name is shown on the page it leads to.
  if (user) {
    return (
      <CtaButton variant="neutral" onClick={() => navigate('/account')}>
        Account
      </CtaButton>
    );
  }
  return (
    <CtaButton variant="ghost" onClick={onSignIn}>
      Sign in
    </CtaButton>
  );
}
