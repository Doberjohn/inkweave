import type {CSSProperties, RefObject} from 'react';
import {CtaButton} from '../../../shared/components';

interface LoadFailedNoticeProps {
  /** What failed to load, as the alert names it: "this card's synergies". */
  what: string;
  /** The alert's look, which follows what it stands in for. */
  lineStyle: CSSProperties;
  onRetry: () => void;
  /**
   * Takes focus before the retry, which swaps the notice for a loading state and so unmounts the
   * button that had it: the region around the notice, so focus stays where the reader is.
   */
  focusOnRetry: RefObject<HTMLElement | null>;
}

/**
 * In place of something a page was loading when its file failed (an error status, or no
 * connection): what failed, and a Try again that loads it again. An alert: it takes the place of
 * content the reader was waiting for. It renders the line and its button alone, so the box around
 * them stays the caller's: the box of what it stands in for.
 */
export function LoadFailedNotice({what, lineStyle, onRetry, focusOnRetry}: LoadFailedNoticeProps) {
  const retry = () => {
    focusOnRetry.current?.focus({preventScroll: true});
    onRetry();
  };
  return (
    <>
      <p role="alert" style={lineStyle}>
        {`Couldn't load ${what}.`}
      </p>
      <CtaButton variant="ghost" onClick={retry}>
        Try again
      </CtaButton>
    </>
  );
}
