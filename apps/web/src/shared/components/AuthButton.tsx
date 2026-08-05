import {useSession} from '../contexts/SessionContext';
import {CtaButton} from './CtaButton';

interface AuthButtonProps {
  /** Opens the caller's SignInDialog. Only called when signed out. */
  onSignIn: () => void;
}

/**
 * The sign in / sign out control, without a dialog.
 *
 * Two surfaces render this: the desktop header's rightmost slot (`HeaderAuth` in
 * CompactHeader) and `/decks` on mobile, where no header exists. It deliberately
 * does NOT own a `SignInDialog`, because `DecksPage` already renders one for
 * `NewDeckDialog`'s "keep both" link and a second would be a duplicate overlay.
 * Dialog ownership stays with the caller; only the button rule is shared.
 *
 * Renders NOTHING while `loading`, and that is the load-bearing part. `user` is
 * null during that window, so the naive version shows "Sign in" and then swaps to
 * "Sign out" once auth resolves: the wrong state, flashed on every page load for
 * every returning user. Also renders nothing when auth is not configured at all
 * (`enabled: false`), which is how the app degrades without Supabase env.
 */
export function AuthButton({onSignIn}: AuthButtonProps) {
  const {user, enabled, loading, signOut} = useSession();

  if (!enabled || loading) return null;

  if (user) {
    return (
      <CtaButton variant="neutral" onClick={() => void signOut()}>
        Sign out
      </CtaButton>
    );
  }
  return (
    <CtaButton variant="ghost" onClick={onSignIn}>
      Sign in
    </CtaButton>
  );
}
