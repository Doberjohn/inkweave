import {useRef} from 'react';
import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {fingerMove, touchMoveKept} from '../../test-utils/touchMove';
import {useTouchHold} from '../useTouchHold';

function Held({enabled = true, holding}: {enabled?: boolean; holding: () => boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  useTouchHold(ref, {enabled, holding});
  return <div ref={ref} data-testid="held" />;
}

const held = () => screen.getByTestId('held');

describe('useTouchHold', () => {
  it('keeps a touch from the page while a drag holds it, and only then', () => {
    let holding = false;
    render(<Held holding={() => holding} />);

    expect(touchMoveKept(held())).toBe(false);
    holding = true;
    expect(touchMoveKept(held())).toBe(true);
  });

  // Chrome warns of a cancel it ignores: a move it has given its scroll already can't be kept.
  it('leaves a move the browser can no longer cancel alone', () => {
    render(<Held holding={() => true} />);
    const move = fingerMove({cancelable: false});
    const preventDefault = vi.spyOn(move, 'preventDefault');

    held().dispatchEvent(move);

    expect(preventDefault).not.toHaveBeenCalled();
  });

  // A pinch on the card zooms the page, a drag under way or not (cubic, PR #965).
  it("leaves a second finger's moves to the browser", () => {
    render(<Held holding={() => true} />);

    expect(touchMoveKept(held(), 2)).toBe(false);
  });

  it('holds nothing while disabled, or once unmounted', () => {
    const {rerender, unmount} = render(<Held enabled={false} holding={() => true} />);
    expect(touchMoveKept(held())).toBe(false);

    rerender(<Held holding={() => true} />);
    const el = held();
    unmount();
    expect(touchMoveKept(el)).toBe(false);
  });
});
