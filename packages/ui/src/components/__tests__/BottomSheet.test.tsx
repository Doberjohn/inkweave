import {createRef} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {DURATION, Z_INDEX} from '../../tokens/theme';
import {BottomSheet} from '../BottomSheet';

interface SheetOptions {
  layer?: 'modal' | 'lightbox';
  visible?: boolean;
}

function renderSheet({layer, visible = true}: SheetOptions = {}) {
  const onTransitionEnd = vi.fn();
  render(
    <BottomSheet
      visible={visible}
      onClose={vi.fn()}
      onTransitionEnd={onTransitionEnd}
      ariaLabel="Test sheet"
      backdropTestId="sheet-scrim"
      sheetRef={createRef<HTMLDivElement>()}
      onKeyDown={vi.fn()}
      layer={layer}>
      <p>Body</p>
    </BottomSheet>,
  );
  // A closing sheet is hidden from the accessibility tree by its class, so find it by its label.
  const sheet = document.querySelector<HTMLElement>('[aria-label="Test sheet"]')!;
  return {sheet, scrim: screen.getByTestId('sheet-scrim'), body: screen.getByText('Body'), onTransitionEnd};
}

describe('BottomSheet', () => {
  it('sits on the modal layer by default', () => {
    const {sheet, scrim} = renderSheet();
    expect(sheet).toHaveStyle({zIndex: String(Z_INDEX.modal)});
    expect(scrim).toHaveStyle({zIndex: String(Z_INDEX.modalBackdrop)});
  });

  it('stacks over an open modal, scrim and all, on the lightbox layer', () => {
    const {sheet, scrim} = renderSheet({layer: 'lightbox'});
    expect(sheet).toHaveStyle({zIndex: String(Z_INDEX.popover)});
    expect(scrim).toHaveStyle({zIndex: String(Z_INDEX.popoverBackdrop)});
  });

  it("ends a closing sheet's exit when its own slide ends, not the scrim's fade or a child's", () => {
    const {sheet, scrim, body, onTransitionEnd} = renderSheet({visible: false});
    fireEvent.transitionEnd(scrim, {propertyName: 'opacity'});
    fireEvent.transitionEnd(body, {propertyName: 'transform'});
    expect(onTransitionEnd).not.toHaveBeenCalled();
    fireEvent.transitionEnd(sheet, {propertyName: 'transform'});
    expect(onTransitionEnd).toHaveBeenCalledOnce();
  });

  it('moves the scrim, the sheet and the top the search sheet changes at one speed', () => {
    const {sheet, scrim} = renderSheet();
    for (const property of ['transform', 'opacity', 'top']) {
      expect(sheet.style.transition).toContain(`${property} ${DURATION.slow}ms`);
    }
    expect(scrim.style.transition).toContain(`opacity ${DURATION.slow}ms`);
  });

  it('shows at once as it opens', () => {
    const {sheet, scrim} = renderSheet();
    expect(sheet.style.transition).toMatch(/visibility 0s$/);
    expect(scrim.style.transition).toMatch(/visibility 0s$/);
  });

  it('hides only once it has slid away', () => {
    const {sheet, scrim} = renderSheet({visible: false});
    expect(sheet.style.transition).toMatch(new RegExp(`visibility 0s linear ${DURATION.slow}ms$`));
    expect(scrim.style.transition).toMatch(new RegExp(`visibility 0s linear ${DURATION.slow}ms$`));
  });
});
