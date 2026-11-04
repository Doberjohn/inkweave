import {createRef} from 'react';
import {describe, it, expect, vi, afterEach} from 'vitest';
import {render} from '@testing-library/react';
import {BottomSheet} from './BottomSheet';

function renderSheet(visible: boolean, onTransitionEnd = vi.fn()) {
  const sheet = (shown: boolean) => (
    <BottomSheet
      visible={shown}
      onClose={() => {}}
      onTransitionEnd={onTransitionEnd}
      ariaLabel="Sheet"
      sheetRef={createRef<HTMLDivElement>()}
      onKeyDown={() => {}}>
      <p>Words</p>
    </BottomSheet>
  );
  const view = render(sheet(visible));
  return {onTransitionEnd, show: (shown: boolean) => view.rerender(sheet(shown))};
}

describe('BottomSheet', () => {
  afterEach(() => vi.useRealTimers());

  it('ends a closed sheet\'s exit even when no slide ends it, as under reduced motion', () => {
    vi.useFakeTimers();
    const {onTransitionEnd, show} = renderSheet(true);
    vi.advanceTimersByTime(5000);
    expect(onTransitionEnd).not.toHaveBeenCalled();
    show(false);
    vi.advanceTimersByTime(499);
    expect(onTransitionEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTransitionEnd).toHaveBeenCalledOnce();
  });

  it('waits no longer once it opens again', () => {
    vi.useFakeTimers();
    const {onTransitionEnd, show} = renderSheet(false);
    show(true);
    vi.advanceTimersByTime(5000);
    expect(onTransitionEnd).not.toHaveBeenCalled();
  });
});
