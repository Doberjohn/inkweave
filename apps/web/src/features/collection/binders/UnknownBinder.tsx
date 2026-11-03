import {CtaButton} from '../../../shared/components';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';

/**
 * In the binder's place when `?custom=` names a binder the reader's shelf doesn't hold: a
 * link to someone else's binder, or one the reader deleted. Said the same either way, so a link
 * tells a stranger nothing of its owner's binders. Open My collection drops the param.
 */
export function UnknownBinder({onOpenMine}: {onOpenMine: () => void}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: SPACING.lg,
        padding: `${SPACING.xxxl}px ${SPACING.lg}px`,
      }}>
      <p role="status" style={{margin: 0, textAlign: 'center', color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
        This binder isn&apos;t on your shelf.
      </p>
      <CtaButton variant="ghost" onClick={onOpenMine}>
        Open My collection
      </CtaButton>
    </div>
  );
}
