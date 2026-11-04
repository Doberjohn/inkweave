import {beforeAll, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from '../collectionParser';
import {useBinderWindow} from './useBinderWindow';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
vi.mock('./binderShelf', () => ({createBinder: vi.fn(), updateBinder: vi.fn()}));
const drafts = vi.hoisted(() => ({count: 0}));
vi.mock('./useBinderDraft', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useBinderDraft')>();
  return {
    ...actual,
    useBinderDraft: (...args: Parameters<typeof actual.useBinderDraft>) => {
      drafts.count += 1;
      return actual.useBinderDraft(...args);
    },
  };
});

const POOL = [
  {id: 'amber-common', name: 'A', fullName: 'A', cost: 1, ink: 'Amber', inkwell: true, type: 'Character', rarity: 'Common', setCode: '12', setNumber: 3},
] as LorcanaCard[];
const ENTRIES: CollectionEntries = {};

interface HostProps {
  readerId: string | null;
  pool: readonly LorcanaCard[] | null;
  entries?: CollectionEntries;
}

function Host({readerId, pool, entries = ENTRIES}: HostProps) {
  const slot = useBinderWindow({readerId, pool, entries});
  return (
    <>
      <button type="button" onClick={() => slot.open?.({binder: null, onSaved: vi.fn()})}>
        Open
      </button>
      {slot.node}
    </>
  );
}

const READY: HostProps = {readerId: 'user-1', pool: POOL};

describe('useBinderWindow', () => {
  // The window is lazy: loaded here first, so a busy run's first transform never outlasts a find.
  beforeAll(async () => {
    await import('./BinderWindow');
  });

  it.each([
    ['collection mode ends', {readerId: 'user-1', pool: null}],
    ['the reader signs out', {readerId: null, pool: POOL}],
  ] as const)('forgets an open window when %s, so it never opens again by itself', async (_, gone) => {
    const {rerender} = render(<Host {...READY} />);
    fireEvent.click(screen.getByRole('button', {name: 'Open'}));
    expect(await screen.findByRole('dialog', {name: 'New binder'})).toBeInTheDocument();

    rerender(<Host {...gone} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<Host {...READY} />);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("unmounts a closed window once its exit has run, so the page's changes cost it nothing", async () => {
    const {rerender} = render(<Host {...READY} />);
    fireEvent.click(screen.getByRole('button', {name: 'Open'}));
    fireEvent.click(await screen.findByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    const before = drafts.count;
    rerender(<Host {...READY} entries={{'amber-common': {normal: 1, foil: 0}}} />);
    expect(drafts.count).toBe(before);
  });
});
