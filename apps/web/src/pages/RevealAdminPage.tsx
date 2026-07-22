import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../shared/constants';
import {GithubTokenGate} from '../shared/components/GithubTokenGate';
import {CtaButton} from '../shared/components';
import {
  useRevealAdmin,
  RevealAdminForm,
  CardPreviewPanel,
  SynergyPreviewPanel,
} from '../features/reveal-admin';

export function RevealAdminPage() {
  const ctrl = useRevealAdmin();

  if (!ctrl.token) {
    return <GithubTokenGate title="Reveal admin" onSave={ctrl.setToken} />;
  }

  return (
    <main style={{maxWidth: 1000, margin: '0 auto', padding: SPACING.lg, color: COLORS.text}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 style={{fontSize: FONT_SIZES.xxl}}>Add a reveal card</h1>
        <button
          onClick={ctrl.clearToken}
          style={{
            background: 'none',
            border: `1px solid ${COLORS.surfaceHover}`,
            color: COLORS.gray600,
            borderRadius: RADIUS.sm,
            padding: '6px 10px',
            cursor: 'pointer',
          }}>
          Forget token
        </button>
      </div>

      {ctrl.result && (
        <div
          role="status"
          style={{
            margin: `${SPACING.md}px 0`,
            padding: SPACING.md,
            background: COLORS.surfaceAlt,
            borderRadius: RADIUS.sm,
          }}>
          Committed. Vercel is deploying (~2-3 min).{' '}
          <a
            href={ctrl.result.commitUrl}
            target="_blank"
            rel="noreferrer"
            style={{color: COLORS.primary500}}>
            View commit
          </a>
        </div>
      )}

      <div style={{display: 'flex', gap: SPACING.xl, flexWrap: 'wrap'}}>
        <section style={{flex: '1 1 380px', minWidth: 320}}>
          <RevealAdminForm
            form={ctrl.form}
            errors={ctrl.validation.errors}
            onChange={ctrl.patchForm}
          />
          {ctrl.publishError && (
            <div style={{color: COLORS.error, fontSize: FONT_SIZES.sm}}>{ctrl.publishError}</div>
          )}
          <CtaButton onClick={ctrl.publish} disabled={!ctrl.canPublish || ctrl.publishing} style={{marginTop: SPACING.md}}>
            {ctrl.publishing ? 'Publishing…' : 'Publish to master'}
          </CtaButton>
        </section>

        <aside
          style={{
            flex: '1 1 280px',
            minWidth: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.lg,
          }}>
          <div>
            <h2 style={{fontSize: FONT_SIZES.xl}}>Preview</h2>
            <CardPreviewPanel card={ctrl.previewCard} onImageChange={ctrl.onImageChange} />
          </div>
          <div>
            <h2 style={{fontSize: FONT_SIZES.xl}}>Synergies</h2>
            <SynergyPreviewPanel groups={ctrl.synergyGroups} />
          </div>
        </aside>
      </div>
    </main>
  );
}
