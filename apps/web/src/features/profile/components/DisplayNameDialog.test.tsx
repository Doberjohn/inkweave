import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import {DisplayNameDialog} from './DisplayNameDialog';

/**
 * Dismissal while a save is in flight.
 *
 * The Cancel button was already disabled during a save, but Escape and the backdrop
 * were not: both reach the dialog through its own `close`, bypassing that button. This
 * dialog is the only place the write's failure is reported, so dismissing it mid-flight
 * lost the answer and left the user unsure whether the name had been stored.
 *
 * Escape is the route exercised here because the backdrop is rendered by DialogShell
 * with no testid at this call site. Both arrive at the same handler, so one covers both.
 */

const mockUpdate = vi.hoisted(() => vi.fn());

vi.mock('../profileRepository', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../profileRepository')>()),
  updateDisplayName: mockUpdate,
}));

const CURRENT = 'Doberjohn';

function setup() {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <DisplayNameDialog isOpen onClose={onClose} userId="u1" current={CURRENT} onSaved={onSaved} />,
  );
  return {onClose, onSaved};
}

/** Type a different name, so `canSave` lets the Save button through. */
function startSave() {
  fireEvent.change(screen.getByLabelText('Display name'), {target: {value: 'A New Name'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save'}));
}

const pressEscape = () => fireEvent.keyDown(document, {key: 'Escape'});

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({data: 'A New Name', error: null});
});

describe('DisplayNameDialog dismissal', () => {
  // The control: without it, a guard that never closes anything would also pass below.
  it('Escape dismisses the dialog when no save is running', () => {
    const {onClose} = setup();
    pressEscape();
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape does not dismiss while a save is in flight', async () => {
    let settle!: (value: {data: string | null; error: string | null}) => void;
    mockUpdate.mockReturnValue(new Promise((resolve) => (settle = resolve)));

    const {onClose} = setup();
    startSave();
    await screen.findByRole('button', {name: 'Saving…'});

    pressEscape();
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => settle({data: 'A New Name', error: null}));
  });

  it('closes itself once the save succeeds', async () => {
    const {onClose, onSaved} = setup();
    startSave();

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('A New Name'));
    expect(onClose).toHaveBeenCalled();
  });

  // A failed save keeps the dialog open so the error has somewhere to show, which is
  // the whole reason dismissal is blocked while the request is outstanding.
  it('stays open and reports when the save fails', async () => {
    mockUpdate.mockResolvedValue({data: null, error: 'Could not save that name. Try again.'});
    const {onClose} = setup();
    startSave();

    await screen.findByRole('alert');
    expect(onClose).not.toHaveBeenCalled();
  });
});
