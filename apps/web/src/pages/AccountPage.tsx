import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  BackLink,
  CompactHeader,
  CtaButton,
  EtherealBackground,
  PageTitle,
  Seo,
} from '../shared/components';
import {SignInDialog} from '../shared/components/SignInDialog';
import {DisplayNameDialog, useProfile, type PublicIdentity} from '../features/profile';
import {useSession} from '../shared/contexts/SessionContext';
import {useResponsive} from '../shared/hooks';
import {CAP_LABEL, COLORS, FONT_SIZES, FONTS, SPACING, SURFACE_CARD} from '../shared/constants';

/**
 * The account page (#553 follow-on).
 *
 * WHY IT EXISTS, beyond holding these particular controls: the app had no account
 * surface, so anything account-shaped got parented to whatever page was nearby —
 * and when that page changed, the feature was orphaned. `DisplayNameDialog` lost
 * caller at all. Both are complete, tested components that nothing could open.
 * This page is mostly mount sites, which is the point.
 *
 * Design: `docs/deck-builder/2026-08-11-account-page-design.md`.
 */

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <section style={{...SURFACE_CARD, padding: SPACING.xl, marginBottom: SPACING.lg}}>
      <h2 style={{...CAP_LABEL, margin: `0 0 ${SPACING.md}px`}}>{title}</h2>
      {children}
    </section>
  );
}

function Row({label, value, action}: {label: string; value: string; action?: React.ReactNode}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        flexWrap: 'wrap',
        padding: `${SPACING.sm}px 0`,
      }}>
      <span style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`, minWidth: '12ch'}}>
        {label}
      </span>
      <span style={{color: COLORS.text, fontSize: `${FONT_SIZES.md}px`}}>{value}</span>
      {action && <span style={{marginLeft: 'auto'}}>{action}</span>}
    </div>
  );
}


function IdentitySection({
  identity,
  onChange,
}: {
  identity: PublicIdentity | null;
  onChange: () => void;
}) {
  return (
    <Section title="Identity">
      {/* Read-only BY CONSTRUCTION: uniqueness is enforced by the index, so
          claiming a handle is a server-side write-and-catch-23505. An edit field
          would need a whole availability flow. The display name is editable
          precisely because it carries no uniqueness constraint. */}
      <Row label="Handle" value={identity ? `@${identity.handle}` : '—'} />
      <Row
        label="Display name"
        value={identity?.displayName ?? '—'}
        action={
          identity && (
            <CtaButton variant="ghost" onClick={onChange}>
              Change
            </CtaButton>
          )
        }
      />
      <p
        style={{
          color: COLORS.textMuted,
          fontSize: `${FONT_SIZES.xs}px`,
          margin: `${SPACING.sm}px 0 0`,
        }}>
        Your display name appears on every deck you publish. Your handle is permanent.
      </p>
    </Section>
  );
}

/** The window before the stored session resolves, when `user` is null but nobody is
 *  signed out yet. Rendering SignedOut here would flash "Sign in" at a returning user
 *  before their own account replaced it, which is also what they would see for a moment
 *  on every return from the OAuth callback. */
function Checking() {
  return (
    <Section title="Account">
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.md}px`, margin: 0}}>
        Checking your session…
      </p>
    </Section>
  );
}

/**
 * Sign-out, with its failure visible.
 *
 * Supabase can refuse a logout (an expired refresh token, a dropped connection). The
 * context used to discard that, so the button appeared to do nothing while the user
 * stayed signed in, which reads as a broken button rather than a failed request.
 */
function SessionSection({onSignOut}: {onSignOut: () => Promise<{error: string | null}>}) {
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    const {error: failure} = await onSignOut();
    setError(failure);
  };
  return (
    <Section title="Session">
      <CtaButton variant="neutral" onClick={() => void run()}>
        Sign out
      </CtaButton>
      {error && (
        <p
          role="alert"
          style={{
            color: COLORS.error,
            fontSize: `${FONT_SIZES.md}px`,
            margin: `${SPACING.md}px 0 0`,
          }}>
          {error}
        </p>
      )}
    </Section>
  );
}

/** Signed-out state. A prompt, NOT a redirect: a redirect discards the URL, so a
 *  shared or bookmarked /account link would look broken rather than gated. */
function SignedOut({onSignIn}: {onSignIn: () => void}) {
  return (
    <Section title="Account">
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.md}px`, margin: 0}}>
        Sign in to name yourself.
      </p>
      <CtaButton onClick={onSignIn} style={{marginTop: SPACING.lg}}>
        Sign in
      </CtaButton>
    </Section>
  );
}

export function AccountPage() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const {user, loading, signOut} = useSession();
  const {identity, adoptDisplayName} = useProfile();

  const [showSignIn, setShowSignIn] = useState(false);
  const [showName, setShowName] = useState(false);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
        // AppLayout already pads the Outlet by the bottom-nav height whenever that nav
        // shows, so repeating it here stacked a second clearance under the content.
        paddingBottom: isMobile ? 0 : SPACING.xxxl,
      }}>
      <Seo
        title="Your account | Inkweave"
        description="Manage your Inkweave display name."
        canonicalPath="/account"
        noindex
      />
      <EtherealBackground />
      <CompactHeader isMobile={isMobile} />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 720,
          margin: '0 auto',
          padding: isMobile ? SPACING.lg : `${SPACING.xxl}px 32px`,
        }}>
        <BackLink onClick={() => void navigate("/browse")} label="Back to browse" />
        <PageTitle style={{padding: `${SPACING.md}px 0 ${SPACING.xl}px`}}>Your account</PageTitle>

        {loading ? (
          <Checking />
        ) : user === null ? (
          <SignedOut onSignIn={() => setShowSignIn(true)} />
        ) : (
          <>
            <IdentitySection identity={identity} onChange={() => setShowName(true)} />
            <SessionSection onSignOut={signOut} />
          </>
        )}
      </div>

      <SignInDialog isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
      {user && identity && (
        <DisplayNameDialog
          isOpen={showName}
          onClose={() => setShowName(false)}
          userId={user.id}
          current={identity.displayName}
          onSaved={adoptDisplayName}
        />
      )}
    </main>
  );
}
