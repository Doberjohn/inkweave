import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import type {FilterDraft} from '../../../shared/hooks/useFilterParams';
import {WHOLE_COLLECTION} from '../binderCards';
import type {SaveOffer} from './binderChoices';
import type {Binder} from './binderRules';
import type {CreateResult} from './shelfStore';
import type {WindowAsk} from './useBinderWindow';
import {useSaveAsBinder, type SaveFor} from './useSaveAsBinder';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const writes = vi.hoisted(() => ({createBinder: vi.fn<(make: unknown) => Promise<CreateResult>>()}));
vi.mock('./shelfStore', () => writes);

const OFFER: SaveOffer = {scope: WHOLE_COLLECTION, rules: 'ink=Amber', line: 'Amber ink', figures: {complete: 2, master: 1, cards: 5}};
const MADE: Binder = {id: 'b9', name: 'Amber', scope: WHOLE_COLLECTION, rules: 'ink=Amber', pages: 4, cover: null, place: 0};
const DRAFT: FilterDraft = {inks: ['Amber'], types: [], costs: [], opts: {}};

function Host({before, ...page}: SaveFor & {before?: () => void}) {
  const slot = useSaveAsBinder(page);
  return (
    <>
      {/* The set picker's button, which a binder opened in place hands focus to. */}
      <button type="button" data-set-picker="">
        Amber
      </button>
      <div data-testid="foot">{slot.render(DRAFT, 'elsa', before)}</div>
      {slot.node}
    </>
  );
}

function renderHost(over: Partial<SaveFor> & {before?: () => void} = {}) {
  const page = {
    readerId: 'user-1',
    offerOf: vi.fn<NonNullable<SaveFor['offerOf']>>(() => OFFER),
    scope: WHOLE_COLLECTION,
    openWindow: vi.fn<(ask: WindowAsk) => void>(),
    openBinder: vi.fn<(binder: Binder) => void>(),
    ...over,
  };
  const view = render(<Host {...page} />);
  return {page, view};
}

const foot = () => screen.queryByRole('button', {name: 'Save as a binder'});

describe('useSaveAsBinder', () => {
  // The box is lazy: loaded here first, so a busy run's first transform never outlasts a find.
  beforeAll(async () => {
    await import('./SaveAsBinder');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    writes.createBinder.mockResolvedValue({binder: MADE});
  });

  it("asks for an offer for the page's filters, search and set, and draws the foot with its line", () => {
    const {page} = renderHost();
    expect(page.offerOf).toHaveBeenCalledWith({draft: DRAFT, query: 'elsa', scope: WHOLE_COLLECTION});
    expect(foot()).toBeInTheDocument();
    expect(screen.getByText('Keeps Amber ink as a binder of its own: 5 cards')).toBeInTheDocument();
  });

  it.each([
    ['signed out, without a collection, or in a friend binder', {readerId: null}],
    ['the shelf has no room, or the binder is not on it', {offerOf: null}],
    ['the filters make no binder', {offerOf: () => null}],
  ] as const)('draws nothing while %s', (_, over) => {
    renderHost(over);
    expect(foot()).toBeNull();
  });

  it("applies a sheet's draft first, then opens the box", async () => {
    const order: string[] = [];
    const before = vi.fn(() => order.push('applied'));
    renderHost({before});
    fireEvent.click(foot()!);
    order.push('pressed');
    expect(before).toHaveBeenCalledOnce();
    expect(order).toEqual(['applied', 'pressed']);
    expect(await screen.findByRole('dialog', {name: 'Save as a binder'})).toBeInTheDocument();
  });

  it('opens the binder made in place once it saves, and hands focus to the set picker', async () => {
    const {page} = renderHost();
    fireEvent.click(foot()!);
    await act(async () => fireEvent.click(await screen.findByRole('button', {name: 'Save binder'})));
    expect(page.openBinder).toHaveBeenCalledWith(MADE);
    await waitFor(() => expect(screen.getByRole('button', {name: 'Amber'})).toHaveFocus());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('hands More rules to the window with the name, Sets and rules, and opens what it saves in place', async () => {
    const {page} = renderHost();
    fireEvent.click(foot()!);
    fireEvent.click(await screen.findByRole('button', {name: 'More rules'}));
    const [ask] = vi.mocked(page.openWindow!).mock.calls[0];
    expect(ask).toMatchObject({binder: null, seed: {name: 'Amber', scope: WHOLE_COLLECTION, rules: 'ink=Amber'}});
    act(() => ask.onSaved(MADE));
    expect(page.openBinder).toHaveBeenCalledWith(MADE);
  });

  it('drops an open box once the page can no longer save one, so it never opens again by itself', async () => {
    const {page, view} = renderHost();
    fireEvent.click(foot()!);
    expect(await screen.findByRole('dialog', {name: 'Save as a binder'})).toBeInTheDocument();
    view.rerender(<Host {...page} readerId={null} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<Host {...page} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
