import {useId} from 'react';
import {Switch} from 'inkweave-ui/components/Switch';
import {LinkButton} from '../../shared/components';
import {COLORS, FONT_SIZES, SPACING} from '../../shared/constants';
import type {CollectionSharing} from './useCollectionSharing';

const LINE: React.CSSProperties = {
  color: COLORS.textMuted,
  fontSize: `${FONT_SIZES.md}px`,
  margin: `${SPACING.xs}px 0 0`,
};

/**
 * "Let my friends see my collection", in the Collection section of /account. The
 * switch is named by its title, which flips it too, and described by the line under it.
 * It holds still while it loads or writes.
 */
export function SharingSwitch({sharing}: {sharing: CollectionSharing}) {
  const id = useId();
  return (
    <div>
      <div style={{display: 'flex', alignItems: 'center', gap: SPACING.md}}>
        <Switch
          id={id}
          checked={sharing.on}
          onCheckedChange={sharing.set}
          disabled={sharing.busy || sharing.status !== 'ready'}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-line`}
        />
        <label
          id={`${id}-title`}
          htmlFor={id}
          style={{color: COLORS.text, fontSize: `${FONT_SIZES.lg}px`, fontWeight: 600, cursor: 'pointer'}}>
          Let my friends see my collection
        </label>
      </div>
      <p id={`${id}-line`} style={LINE}>
        Your friends can open your binder and see which cards you own and how many, normal and foil. Turn
        it off any time and they lose access at once.
      </p>
      {sharing.status === 'failed' && (
        <p role="alert" style={{...LINE, display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
          Couldn&rsquo;t load this setting.
          <LinkButton size="sm" onClick={sharing.retry}>
            Retry
          </LinkButton>
        </p>
      )}
      {sharing.writeFailed && (
        <p role="alert" style={LINE}>
          Couldn&rsquo;t change it. Try again.
        </p>
      )}
    </div>
  );
}
