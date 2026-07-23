import type {PendingEdit} from '../useTuningAdmin';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';
import {CtaButton} from '../../../shared/components';

interface PendingTrayProps {
  pending: PendingEdit[];
  publishDisabled: boolean;
  publishing: boolean;
  result: {commitUrl: string} | null;
  error: string | null;
  onRevert: (pathKey: string) => void;
  onClear: () => void;
  onPublish: () => void;
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: SPACING.sm,
  padding: '8px 10px',
  background: COLORS.surfaceAlt,
  border: `1px solid ${COLORS.surfaceHover}`,
  borderRadius: RADIUS.sm,
  marginBottom: SPACING.xs,
  fontSize: FONT_SIZES.sm,
};

const revertBtnStyle = {
  flexShrink: 0,
  background: 'none',
  border: `1px solid ${COLORS.surfaceHover}`,
  color: COLORS.gray600,
  borderRadius: RADIUS.sm,
  padding: '4px 8px',
  cursor: 'pointer',
  fontSize: FONT_SIZES.xs,
};

function PendingEditRow({edit, onRevert}: {edit: PendingEdit; onRevert: (pathKey: string) => void}) {
  return (
    <div style={rowStyle}>
      <div style={{minWidth: 0}}>
        <div style={{color: COLORS.text}}>{edit.label}</div>
        <div style={{color: edit.valid ? COLORS.gray600 : COLORS.error, fontSize: FONT_SIZES.xs}}>
          {edit.valid ? `${String(edit.oldValue)} → ${String(edit.value)}` : edit.error}
        </div>
      </div>
      <button style={revertBtnStyle} onClick={() => onRevert(edit.pathKey)}>
        revert
      </button>
    </div>
  );
}

function PublishButton({disabled, publishing, onClick}: {disabled: boolean; publishing: boolean; onClick: () => void}) {
  return (
    <CtaButton onClick={onClick} disabled={disabled} style={{marginTop: SPACING.md}}>
      {publishing ? 'Publishing…' : 'Publish'}
    </CtaButton>
  );
}

/** Bottom tray listing staged edits as diff rows plus publish/clear actions. */
export function PendingTray({
  pending,
  publishDisabled,
  publishing,
  result,
  error,
  onRevert,
  onClear,
  onPublish,
}: PendingTrayProps) {
  return (
    <section
      aria-label="Pending changes"
      style={{
        marginTop: SPACING.lg,
        paddingTop: SPACING.md,
        borderTop: `1px solid ${COLORS.surfaceBorder}`,
      }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm}}>
        <h2 style={{fontSize: FONT_SIZES.xl, margin: 0}}>Pending changes</h2>
        {pending.length > 0 && (
          <button onClick={onClear} style={revertBtnStyle}>
            Clear all
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <p style={{color: COLORS.gray600, fontSize: FONT_SIZES.sm, margin: 0}}>No pending changes</p>
      ) : (
        pending.map((edit) => <PendingEditRow key={edit.pathKey} edit={edit} onRevert={onRevert} />)
      )}

      {error && (
        <div style={{color: COLORS.error, fontSize: FONT_SIZES.sm, marginTop: SPACING.sm}}>{error}</div>
      )}

      {result && (
        <div style={{color: COLORS.success, fontSize: FONT_SIZES.sm, marginTop: SPACING.sm}}>
          Published.{' '}
          <a href={result.commitUrl} target="_blank" rel="noreferrer" style={{color: COLORS.primary}}>
            View commit
          </a>
          . Changes go live on the next Vercel redeploy.
        </div>
      )}

      <PublishButton disabled={publishDisabled} publishing={publishing} onClick={onPublish} />
    </section>
  );
}
