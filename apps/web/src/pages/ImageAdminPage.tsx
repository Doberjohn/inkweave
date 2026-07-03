import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../shared/constants';
import {GithubTokenGate} from '../shared/components/GithubTokenGate';
import {useImageAdmin, CardImagePicker, ImageComparePanel} from '../features/image-admin';

export function ImageAdminPage() {
  const ctrl = useImageAdmin();

  if (!ctrl.token) {
    return <GithubTokenGate title="Card image admin" onSave={ctrl.setToken} />;
  }

  return (
    <main style={{maxWidth: 900, margin: '0 auto', padding: SPACING.lg, color: COLORS.text}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 style={{fontSize: FONT_SIZES.xxl}}>Update a card image</h1>
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
          Committed. The new image goes live after the convert workflow runs and Vercel redeploys
          (~a few minutes).{' '}
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
        <section style={{flex: '1 1 320px', minWidth: 300}}>
          <h2 style={{fontSize: FONT_SIZES.xl}}>1. Pick a card</h2>
          <CardImagePicker
            cards={ctrl.cards}
            selectedId={ctrl.selectedCard?.id ?? null}
            onSelect={ctrl.selectCard}
          />
        </section>

        <aside style={{flex: '1 1 360px', minWidth: 320}}>
          <h2 style={{fontSize: FONT_SIZES.xl}}>2. Upload the new image</h2>
          {ctrl.selectedCard ? (
            <>
              <p style={{color: COLORS.gray600, fontSize: FONT_SIZES.xs, margin: `0 0 ${SPACING.sm}px`}}>
                Click the New tile to choose a jpg, png, or webp.
              </p>
              <ImageComparePanel
                card={ctrl.selectedCard}
                newImageUrl={ctrl.newImageUrl}
                onImageChange={ctrl.onImageChange}
              />
              {ctrl.imageName && (
                <div style={{color: COLORS.gray600, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm}}>
                  {ctrl.imageName}
                </div>
              )}
            </>
          ) : (
            <p style={{color: COLORS.gray600, fontSize: FONT_SIZES.sm}}>Pick a card to enable upload.</p>
          )}

          {ctrl.publishError && (
            <div style={{color: COLORS.error, fontSize: FONT_SIZES.sm, marginTop: SPACING.sm}}>
              {ctrl.publishError}
            </div>
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
        </aside>
      </div>
    </main>
  );
}
