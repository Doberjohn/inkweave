import {Suspense, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  BackLink,
  CompactHeader,
  CtaButton,
  EtherealBackground,
  IconButton,
  PageTitle,
  PencilIcon,
  Seo,
} from '../shared/components';
import {SignInDialog} from '../shared/components/SignInDialog';
import {DisplayNameDialog, useProfile, type PublicIdentity} from '../features/profile';
import {SHOW_COLLECTION} from '../features/collection/flag';
import {SHOW_FRIENDS} from '../features/friends/flag';
import {lazyWithRetry} from '../shared/lib/lazyWithRetry';
import {useSession} from '../shared/contexts/SessionContext';
import {useResponsive} from '../shared/hooks';
import {CAP_LABEL, COLORS, FONT_SIZES, FONTS, SPACING, SURFACE_CARD} from '../shared/constants';

/**
 * The account page (#553 follow-on).
 *
 * WHY IT EXISTS, beyond holding these particular controls: the app had no account
 * surface, so anything account-shaped got parented to whatever page was nearby —
 * and when that page changed, the feature was orphaned. `DisplayNameDialog` lost
 * its only render site to `8d9a3ae3`; `ImportCollectionDialog` shipped with no
 * caller at all. Both are complete, tested components that nothing could open.
 * This page is mostly mount sites, which is the point.
 *
 * Design: `docs/deck-builder/2026-08-11-account-page-design.md` on the `deck-builder`
 * branch; that folder has not been brought to master.
 */

/** One card on the page, under its h2. Exported for the sections that load as modules of their own. */
export function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <section style={{...SURFACE_CARD, padding: SPACING.xl, marginBottom: SPACING.lg}}>
      <h2 style={{...CAP_LABEL, margin: `0 0 ${SPACING.md}px`}}>{title}</h2>
      {children}
    </section>
  );
}

/**
 * When the collection last changed, as a locale date, or a dash. Hoisted so the section carries
 * one fewer branch. An import stamps the copy and so does each count changed in the app (#826),
 * so the copy's stamp is its last change.
 */
function formatLastChanged(importedAt: number | null): string {
  if (importedAt === null) return '—';
  return new Date(importedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function Row({
  label,
  value,
  valueClassName,
  action,
}: {
  label: string;
  value: string;
  /** `ph-no-capture` keeps PostHog's autocapture away from the value (#827). */
  valueClassName?: string;
  /** An icon button, right after the value it acts on (#852). */
  action?: React.ReactNode;
}) {
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
      <span style={{display: 'inline-flex', alignItems: 'center', gap: SPACING.xxs, minWidth: 0}}>
        <span className={valueClassName} style={{color: COLORS.text, fontSize: `${FONT_SIZES.md}px`}}>
          {value}
        </span>
        {action}
      </span>
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
      {/* PostHog's autocapture reads the text of the elements it records (#827). Neither value
          sits in a link or button today; ph-no-capture keeps both out of it if that changes,
          while the pencil's clicks still count. */}
      <Row
        label="Handle"
        value={identity ? `@${identity.handle}` : '—'}
        valueClassName="ph-no-capture"
      />
      <Row
        label="Display name"
        value={identity?.displayName ?? '—'}
        valueClassName="ph-no-capture"
        action={
          identity && (
            <IconButton aria-label="Change display name" onClick={onChange}>
              <PencilIcon />
            </IconButton>
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
 *
 * The request is also gated while it is in flight. Without that the button stayed live
 * through a slow logout, so an impatient second click fired a second `signOut`, and the
 * previous attempt's error sat on screen the whole time the retry was running.
 */
function SessionSection({onSignOut}: {onSignOut: () => Promise<{error: string | null}>}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    // Cleared up front, so a retry is not read against the previous attempt's message.
    setError(null);
    const {error: failure} = await onSignOut();
    // Only these two lines matter on FAILURE, where the page is still mounted because
    // the session survived. A success ends the session, so AccountPage swaps in
    // SignedOut and this component is gone before they land; React drops them.
    setError(failure);
    setBusy(false);
  };

  return (
    <Section title="Session">
      <CtaButton variant="neutral" onClick={() => void run()} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out'}
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

/** The destructive half, split out so its three states do not land on the section. */
function ClearControls({
  confirming,
  onAsk,
  onConfirm,
  onCancel,
}: {
  confirming: boolean;
  onAsk: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!confirming) {
    return (
      <CtaButton variant="neutral" onClick={onAsk}>
        Clear
      </CtaButton>
    );
  }
  // Confirm in place rather than a dialog: one destructive action with no undo,
  // and a second overlay for a single yes/no is heavier than the decision.
  return (
    <>
      <CtaButton variant="neutral" onClick={onConfirm}>
        Delete my collection
      </CtaButton>
      <CtaButton variant="ghost" onClick={onCancel}>
        Cancel
      </CtaButton>
    </>
  );
}

interface CollectionSectionProps {
  hasCollection: boolean;
  /**
   * No collection here yet and the account's copy has not answered: on a new browser
   * that copy may BE the collection, so the section waits instead of offering an
   * import over it (`useCollection().syncing`).
   */
  checking: boolean;
  owned: number;
  importedAt: number | null;
  confirming: boolean;
  onImport: () => void;
  onAskClear: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
}

export function CollectionSection({
  hasCollection,
  checking,
  owned,
  importedAt,
  confirming,
  onImport,
  onAskClear,
  onConfirmClear,
  onCancelClear,
}: CollectionSectionProps) {
  return (
    <Section title="Collection">
      {hasCollection ? (
        <>
          <Row label="Cards owned" value={owned.toLocaleString()} />
          <Row label="Last changed" value={formatLastChanged(importedAt)} />
        </>
      ) : (
        <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.md}px`, margin: 0}}>
          {checking
            ? 'Checking your account for a collection…'
            : 'Import a Dreamborn CSV export to see what you own while you browse.'}
        </p>
      )}
      <div style={{display: 'flex', gap: SPACING.md, marginTop: SPACING.lg, flexWrap: 'wrap'}}>
        <CtaButton variant="ghost" onClick={onImport} disabled={checking}>
          {hasCollection ? 'Re-import' : 'Import collection'}
        </CtaButton>
        {hasCollection && (
          <ClearControls
            confirming={confirming}
            onAsk={onAskClear}
            onConfirm={onConfirmClear}
            onCancel={onCancelClear}
          />
        )}
      </div>
      {confirming && (
        <p
          role="alert"
          style={{
            color: COLORS.textMuted,
            fontSize: `${FONT_SIZES.xs}px`,
            margin: `${SPACING.md}px 0 0`,
          }}>
          {/* The account copy goes too: this page is signed-in only, and a clear
              while signed in deletes the server row as well (#555). */}
          This deletes your imported collection from this browser and from your account. It cannot be
          undone.
        </p>
      )}
    </Section>
  );
}

/**
 * The collection section and its import (#553 Phase C), only under `SHOW_COLLECTION`.
 * A component of its own because its hooks need the collection providers, which mount
 * only under that flag, and a hook cannot be skipped; a component can. And a MODULE of
 * its own, loaded lazily, so a flag-off build never requests the collection's data layer
 * for /account (`flag.ts`: off means NOT LOADED).
 */
const AccountCollection = SHOW_COLLECTION ? lazyWithRetry(() => import('./AccountCollection'), 'AccountCollection') : null;

/**
 * The Friends section (#852), only under `SHOW_FRIENDS`, in a module of its own for the
 * same reason: a flag-off build never requests the friends code for /account. Its UI stays
 * out of this file too, since this route's chunk keeps every export it has and counts in
 * User-facing JS.
 */
const AccountFriends = SHOW_FRIENDS ? lazyWithRetry(() => import('./AccountFriends'), 'AccountFriends') : null;

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
          // One boundary around every section: while the friends and collection modules
          // load, the page keeps its "Checking your session…" card, and the sections arrive
          // together. A boundary around the collection alone let Session paint first, then
          // pushed it down when the collection landed between it and Identity.
          <Suspense fallback={<Checking />}>
            <IdentitySection identity={identity} onChange={() => setShowName(true)} />
            {AccountFriends && <AccountFriends userId={user.id} />}
            {AccountCollection && <AccountCollection />}
            <SessionSection onSignOut={signOut} />
          </Suspense>
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
