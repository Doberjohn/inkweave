import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {trackEvent} from '../../../shared/lib/analytics';
import type {Binder} from './binderRules';
import type {UpdateResult} from './binderShelf';
import {RenameBinderDialog, type RenameBinderDialogProps} from './RenameBinderDialog';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const writes = vi.hoisted(() => ({
  updateBinder: vi.fn<(change: {readerId: string; id: string; patch: unknown}) => Promise<UpdateResult>>(),
}));
vi.mock('./binderShelf', () => writes);

const AMBER: Binder = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', pages: 4, cover: null, place: 0};

function renderDialog(over: Partial<RenameBinderDialogProps> = {}) {
  const props: RenameBinderDialogProps = {
    isOpen: true,
    binder: AMBER,
    readerId: 'user-1',
    isMobile: false,
    onSaved: vi.fn(),
    onClose: vi.fn(),
    onGone: vi.fn(),
    ...over,
  };
  render(<RenameBinderDialog {...props} />);
  return props;
}

const nameField = () => screen.getByRole('textbox', {name: 'Name'});
const save = () => screen.getByRole('button', {name: /^Sav/});
const type = (name: string) => fireEvent.change(nameField(), {target: {value: name}});

describe('RenameBinderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.updateBinder.mockResolvedValue({binder: {...AMBER, name: 'Gold'}});
  });

  it("opens filled in with the binder's name, which stays out of the dialog's own name", () => {
    renderDialog();
    expect(screen.getByRole('dialog', {name: 'Rename binder'})).toBeInTheDocument();
    expect(nameField()).toHaveValue('Amber');
    expect(nameField().closest('.ph-no-capture')).not.toBeNull();
  });

  it('waits for a name the table takes and another than the binder has', () => {
    renderDialog();
    expect(save()).toBeDisabled();
    type('   ');
    expect(save()).toBeDisabled();
    type(' Amber ');
    expect(save()).toBeDisabled();
    type('Gold');
    expect(save()).toBeEnabled();
  });

  it('saves the trimmed name, counts what changed, never the name, and hands back the stored binder', async () => {
    const props = renderDialog();
    type('  Gold ');
    await act(async () => fireEvent.click(save()));
    expect(writes.updateBinder).toHaveBeenCalledExactlyOnceWith({readerId: 'user-1', id: 'b1', patch: {name: 'Gold'}});
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('binder_changed', {what: 'name'});
    expect(props.onSaved).toHaveBeenCalledWith({...AMBER, name: 'Gold'});
  });

  it('holds while the save runs: Cancel, Escape and the field all wait', async () => {
    let land!: (result: UpdateResult) => void;
    writes.updateBinder.mockReturnValue(new Promise((resolve) => (land = resolve)));
    const props = renderDialog();
    type('Gold');
    await act(async () => fireEvent.click(save()));
    expect(screen.getByRole('button', {name: 'Saving…'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    expect(nameField()).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => land({binder: {...AMBER, name: 'Gold'}}));
  });

  it.each([
    ['failed', "Couldn't save the binder. Try again."],
    ['gone', "This binder isn't on your shelf anymore."],
  ] as const)('keeps the dialog and the name typed when the save comes back %s', async (problem, words) => {
    writes.updateBinder.mockResolvedValue({problem});
    const props = renderDialog();
    type('Gold');
    await act(async () => fireEvent.click(save()));
    expect(screen.getByRole('alert')).toHaveTextContent(words);
    expect(nameField()).toHaveValue('Gold');
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('closes on Cancel while nothing is on its way', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("draws a phone's sheet", () => {
    renderDialog({isMobile: true});
    expect(screen.getByRole('dialog', {name: 'Rename binder'})).toHaveClass('overlay-slide-up');
  });
});
