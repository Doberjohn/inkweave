import {useState} from 'react';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../shared/constants';
import {
  validateToken,
  useRevealAdmin,
  RevealAdminForm,
  CardPreviewPanel,
  SynergyPreviewPanel,
} from '../features/reveal-admin';

function TokenGate({onSave}: {onSave: (token: string) => void}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    setError(null);
    const info = await validateToken(value.trim());
    setBusy(false);
    if (info.ok && info.canPush) {
      onSave(value.trim());
    } else {
      setError(info.error ?? 'Token validation failed');
    }
  }

  return (
    <div style={{maxWidth: 460, margin: '0 auto', padding: SPACING.lg, color: COLORS.text}}>
      <h1 style={{fontSize: FONT_SIZES.xxl}}>Reveal admin</h1>
      <p style={{color: COLORS.gray600, fontSize: FONT_SIZES.sm}}>
        Paste a GitHub fine-grained token scoped to <code>Doberjohn/inkweave</code> with Contents:
        read and write.
      </p>
      <input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="github_pat_..."
        aria-label="GitHub token"
        style={{
          width: '100%',
          padding: '10px',
          background: COLORS.surfaceAlt,
          color: COLORS.text,
          border: `1px solid ${COLORS.surfaceHover}`,
          borderRadius: RADIUS.sm,
        }}
      />
      {error && (
        <div style={{color: COLORS.error, fontSize: FONT_SIZES.sm, marginTop: SPACING.xs}}>{error}</div>
      )}
      <button
        onClick={check}
        disabled={busy || !value.trim()}
        style={{
          marginTop: SPACING.sm,
          padding: '10px 16px',
          background: COLORS.primary500,
          color: COLORS.white,
          border: 'none',
          borderRadius: RADIUS.sm,
          cursor: 'pointer',
        }}>
        {busy ? 'Checking…' : 'Save token'}
      </button>
    </div>
  );
}

export function RevealAdminPage() {
  const ctrl = useRevealAdmin();

  if (!ctrl.token) {
    return <TokenGate onSave={ctrl.setToken} />;
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
            imageName={ctrl.imageName}
            onChange={ctrl.patchForm}
            onImageChange={ctrl.onImageChange}
          />
          {ctrl.publishError && (
            <div style={{color: COLORS.error, fontSize: FONT_SIZES.sm}}>{ctrl.publishError}</div>
          )}
          <button
            onClick={ctrl.publish}
            disabled={!ctrl.canPublish || ctrl.publishing}
            style={{
              marginTop: SPACING.md,
              padding: '12px 20px',
              background: ctrl.canPublish ? COLORS.primary500 : COLORS.surfaceHover,
              color: COLORS.white,
              border: 'none',
              borderRadius: RADIUS.sm,
              cursor: ctrl.canPublish ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}>
            {ctrl.publishing ? 'Publishing…' : 'Publish to master'}
          </button>
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
            <CardPreviewPanel card={ctrl.previewCard} />
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
