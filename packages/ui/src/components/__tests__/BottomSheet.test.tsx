import {createRef} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {Z_INDEX} from '../../tokens/theme';
import {BottomSheet} from '../BottomSheet';

function renderSheet(layer?: 'modal' | 'lightbox') {
  render(
    <BottomSheet
      visible
      onClose={vi.fn()}
      onTransitionEnd={vi.fn()}
      ariaLabel="Test sheet"
      backdropTestId="sheet-scrim"
      sheetRef={createRef<HTMLDivElement>()}
      onKeyDown={vi.fn()}
      layer={layer}>
      <p>Body</p>
    </BottomSheet>,
  );
  return {sheet: screen.getByRole('dialog', {name: 'Test sheet'}), scrim: screen.getByTestId('sheet-scrim')};
}

describe('BottomSheet', () => {
  it('sits on the modal layer by default', () => {
    const {sheet, scrim} = renderSheet();
    expect(sheet).toHaveStyle({zIndex: String(Z_INDEX.modal)});
    expect(scrim).toHaveStyle({zIndex: String(Z_INDEX.modalBackdrop)});
  });

  it('stacks over an open modal, scrim and all, on the lightbox layer', () => {
    const {sheet, scrim} = renderSheet('lightbox');
    expect(sheet).toHaveStyle({zIndex: String(Z_INDEX.popover)});
    expect(scrim).toHaveStyle({zIndex: String(Z_INDEX.popoverBackdrop)});
  });
});
