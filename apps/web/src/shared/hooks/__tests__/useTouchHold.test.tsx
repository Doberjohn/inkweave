import {useRef} from 'react';
import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {useTouchHold} from '../useTouchHold';

function Held({enabled = true, holding}: {enabled?: boolean; holding: () => boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  useTouchHold(ref, {enabled, holding});
  return <div ref={ref} data-testid="held" />;
}

/** A finger's move on the element, after its listeners have run. */
function touchMove({cancelable = true} = {}) {
  const move = new Event('touchmove', {bubbles: true, cancelable});
  const preventDefault = vi.spyOn(move, 'preventDefault');
  screen.getByTestId('held').dispatchEvent(move);
  return {kept: move.defaultPrevented, preventDefault};
}

describe('useTouchHold', () => {
  it('keeps a touch from the page while a drag holds it, and only then', () => {
    let holding = false;
    render(<Held holding={() => holding} />);

    expect(touchMove().kept).toBe(false);
    holding = true;
    expect(touchMove().kept).toBe(true);
  });

  // Chrome warns of a cancel it ignores: a move it has given its scroll already can't be kept.
  it('leaves a move the browser can no longer cancel alone', () => {
    render(<Held holding={() => true} />);

    expect(touchMove({cancelable: false}).preventDefault).not.toHaveBeenCalled();
  });

  it('holds nothing while disabled, or once unmounted', () => {
    const {rerender, unmount} = render(<Held enabled={false} holding={() => true} />);
    expect(touchMove().kept).toBe(false);

    rerender(<Held holding={() => true} />);
    const el = screen.getByTestId('held');
    unmount();
    const move = new Event('touchmove', {bubbles: true, cancelable: true});
    el.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(false);
  });
});
