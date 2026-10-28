import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';
import {SharingSwitch} from './SharingSwitch';
import type {CollectionSharing} from './useCollectionSharing';

const sharing = (overrides: Partial<CollectionSharing> = {}): CollectionSharing => ({
  status: 'ready',
  on: false,
  busy: false,
  writeFailed: false,
  set: vi.fn(),
  retry: vi.fn(),
  ...overrides,
});

describe('SharingSwitch (#1045)', () => {
  it('is a switch named by its title and described by the line under it', async () => {
    const state = sharing();
    render(<SharingSwitch sharing={state} />);
    const toggle = screen.getByRole('switch', {name: 'Let my friends see my collection'});
    expect(toggle).toHaveAccessibleDescription(/Turn it off any time and they lose access at once\.$/);
    await userEvent.setup().click(toggle);
    expect(state.set).toHaveBeenCalledWith(true);
  });

  it.each([
    ['loading', sharing({status: 'loading'})],
    ['writing', sharing({busy: true, on: true})],
  ])('holds still while %s', (_case, state) => {
    render(<SharingSwitch sharing={state} />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('offers Retry when the setting did not load', async () => {
    const state = sharing({status: 'failed'});
    render(<SharingSwitch sharing={state} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load this setting.');
    await userEvent.setup().click(screen.getByRole('button', {name: 'Retry'}));
    expect(state.retry).toHaveBeenCalledTimes(1);
  });

  it('says a change that failed failed', () => {
    render(<SharingSwitch sharing={sharing({writeFailed: true})} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t change it. Try again.');
  });
});
