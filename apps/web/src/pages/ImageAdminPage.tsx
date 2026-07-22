import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../shared/constants';
import {GithubTokenGate} from '../shared/components/GithubTokenGate';
import {CtaButton} from '../shared/components';
import {useImageAdmin, CardImagePicker, UploadColumn} from '../features/image-admin';

export function ImageAdminPage() {
  const ctrl = useImageAdmin();

  if (!ctrl.token) {
    return <GithubTokenGate title="Card image admin" onSave={ctrl.setToken} />;
  }

  return (
    <main style={{maxWidth: 900, margin: '0 auto', padding: SPACING.lg, color: COLORS.text}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1 style={{fontSize: FONT_SIZES.xxl}}>Update a card image</h1>
        <CtaButton
          variant="neutral"
          onClick={ctrl.clearToken}
          style={{minHeight: 0, padding: '6px 10px', fontSize: FONT_SIZES.sm}}>
          Forget token
        </CtaButton>
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

        <UploadColumn
          selectedCard={ctrl.selectedCard}
          newImageUrl={ctrl.newImageUrl}
          imageName={ctrl.imageName}
          canPublish={ctrl.canPublish}
          publishing={ctrl.publishing}
          publishError={ctrl.publishError}
          onImageChange={ctrl.onImageChange}
          onPublish={ctrl.publish}
        />
      </div>
    </main>
  );
}
