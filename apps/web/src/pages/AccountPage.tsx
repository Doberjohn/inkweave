import {useState} from 'react';
import {
  BackLink,
  CompactHeader,
  CtaButton,
  EtherealBackground,
  MOBILE_NAV_HEIGHT,
  PageTitle,
  Seo,
} from '../shared/components';
import {SignInDialog} from '../shared/components/SignInDialog';
import {DisplayNameDialog, useProfile, type PublicIdentity} from '../features/profile';
import {
  useCollection,
  useCollectionPool,
  ImportCollectionDialog,
} from '../features/collection';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
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

/** Locale date, or a dash. Hoisted so the page function carries one fewer branch. */
function formatImported(importedAt: number | null): string {
  if (importedAt === null) return '—';
  return new Date(importedAt).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

/** The destructive half, split out so its three states do not land on the page. */
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
  owned: number;
  importedAt: number | null;
  confirming: boolean;
  onImport: () => void;
  onAskClear: () => void;
  onConfirmClear: () => void;
  onCancelClear: () => void;
}

function CollectionSection({
  hasCollection,
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
          <Row label="Imported" value={formatImported(importedAt)} />
        </>
      ) : (
        <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.md}px`, margin: 0}}>
          Import a Dreamborn CSV export to see what you own while you browse.
        </p>
      )}
      <div style={{display: 'flex', gap: SPACING.md, marginTop: SPACING.lg, flexWrap: 'wrap'}}>
        <CtaButton variant="ghost" onClick={onImport}>
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
          This removes your imported collection from this browser. It cannot be undone.
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
        Sign in to name yourself and keep a collection.
      </p>
      <CtaButton onClick={onSignIn} style={{marginTop: SPACING.lg}}>
        Sign in
      </CtaButton>
    </Section>
  );
}

export function AccountPage() {
  const {isMobile} = useResponsive();
  const {user, signOut} = useSession();
  const {identity, adoptDisplayName} = useProfile();
  const {hasCollection, importCollection, clearImported, ownedCount, entries, importedAt} =
    useCollection();
  const {cards} = useCardDataContext();

  const [showSignIn, setShowSignIn] = useState(false);
  const [showName, setShowName] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Widened only while the import is open, so opening /account costs nothing.
  const {pool, isLoading: poolLoading, error: poolError} = useCollectionPool(cards, showImport);

  const owned = Object.keys(entries).filter((id) => ownedCount(id) > 0).length;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
        paddingBottom: isMobile ? MOBILE_NAV_HEIGHT : SPACING.xxxl,
      }}>
      <Seo
        title="Your account | Inkweave"
        description="Manage your Inkweave display name and imported Lorcana collection."
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
        <BackLink to="/browse" label="Back to browse" />
        <PageTitle style={{padding: `${SPACING.md}px 0 ${SPACING.xl}px`}}>Your account</PageTitle>

        {user === null ? (
          <SignedOut onSignIn={() => setShowSignIn(true)} />
        ) : (
          <>
            <IdentitySection identity={identity} onChange={() => setShowName(true)} />
            <CollectionSection
              hasCollection={hasCollection}
              owned={owned}
              importedAt={importedAt}
              confirming={confirmClear}
              onImport={() => setShowImport(true)}
              onAskClear={() => setConfirmClear(true)}
              onConfirmClear={() => {
                clearImported();
                setConfirmClear(false);
              }}
              onCancelClear={() => setConfirmClear(false)}
            />
            <Section title="Session">
              <CtaButton variant="neutral" onClick={() => void signOut()}>
                Sign out
              </CtaButton>
            </Section>
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
      <ImportCollectionDialog
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        pool={pool}
        isPoolReady={!poolLoading && poolError === null}
        onImport={importCollection}
      />
    </main>
  );
}
