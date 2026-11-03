import type {CSSProperties, RefObject} from 'react';
import {CtaButton} from '../../../shared/components';
import {COLORS, FONT_SIZES, FONT_WEIGHT, SPACING} from '../../../shared/constants';

const LAYOUTS: Record<LoadFailedNoticeProps['layout'], {box: CSSProperties; line: CSSProperties}> = {
  stacked: {
    box: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: SPACING.xxl,
      gap: SPACING.md,
    },
    line: {margin: 0, color: COLORS.text, fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHT.semibold},
  },
  inline: {
    box: {display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: SPACING.md},
    line: {margin: 0, color: COLORS.textMuted, fontSize: FONT_SIZES.lg},
  },
};

interface LoadFailedNoticeProps {
  /** What failed to load, as the alert names it: "this card's synergies". */
  what: string;
  onRetry: () => void;
  /**
   * Takes focus before the retry, which swaps the notice for a loading state and so unmounts the
   * button that had it: the region around the notice, so focus stays where the reader is.
   */
  focusOnRetry: RefObject<HTMLElement | null>;
  /**
   * `stacked`, the line over its button, centred in the column it takes: in place of a card's
   * synergies. `inline`, side by side: in place of a row of tiles.
   */
  layout: 'stacked' | 'inline';
  /** The box it fills, such as the placeholder's, so what follows stays put through the retry. */
  style?: CSSProperties;
  testId?: string;
}

/**
 * In place of something a page was loading when its file failed (an error status, or no
 * connection): what failed, and a Try again that loads it again. An alert: it takes the place of
 * content the reader was waiting for.
 */
export function LoadFailedNotice({what, onRetry, focusOnRetry, layout, style, testId}: LoadFailedNoticeProps) {
  const {box, line} = LAYOUTS[layout];
  const retry = () => {
    focusOnRetry.current?.focus({preventScroll: true});
    onRetry();
  };
  return (
    <div data-testid={testId} style={{...box, ...style}}>
      <p role="alert" style={line}>
        {`Couldn't load ${what}.`}
      </p>
      <CtaButton variant="ghost" onClick={retry}>
        Try again
      </CtaButton>
    </div>
  );
}
