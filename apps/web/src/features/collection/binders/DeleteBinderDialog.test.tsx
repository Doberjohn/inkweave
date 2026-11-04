import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {DeleteBinderDialog, type DeleteBinderDialogProps} from './DeleteBinderDialog';

function renderDialog(over: Partial<DeleteBinderDialogProps> = {}) {
  const props = {isOpen: true, name: 'Amber', isMobile: false, deleting: false, failed: false, onConfirm: vi.fn(), onClose: vi.fn(), ...over};
  render(<DeleteBinderDialog {...props} />);
  return props;
}

describe('DeleteBinderDialog', () => {
  it("asks by the binder's name, which stays out of the dialog's own name", () => {
    renderDialog();
    expect(screen.getByRole('heading', {name: 'Delete Amber?'})).toBeInTheDocument();
    expect(screen.getByRole('dialog', {name: 'Delete binder'})).toBeInTheDocument();
    expect(screen.getByText('The binder goes from your shelf. Your cards stay in My collection.')).toBeInTheDocument();
  });

  it('deletes only on Delete binder, and Keep it closes', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', {name: 'Keep it'}));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Delete binder'}));
    expect(props.onConfirm).toHaveBeenCalledOnce();
  });

  it('holds while the delete is on its way: both buttons wait, and Escape does nothing', () => {
    const props = renderDialog({deleting: true});
    expect(screen.getByRole('button', {name: 'Deleting…'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Keep it'})).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('says a failed delete, and offers it again', () => {
    renderDialog({failed: true});
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't delete it. Try again.");
    expect(screen.getByRole('button', {name: 'Delete binder'})).toBeEnabled();
  });

  it("draws a phone's sheet, with the same words", () => {
    renderDialog({isMobile: true});
    expect(screen.getByRole('dialog', {name: 'Delete binder'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Delete Amber?'})).toBeInTheDocument();
  });
});
