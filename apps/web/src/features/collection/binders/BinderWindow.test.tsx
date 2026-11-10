import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {trackEvent} from '../../../shared/lib/analytics';
import type {CollectionEntries} from '../collectionParser';
import type {Binder} from './binderRules';
import type {CreateResult, UpdateResult} from './binderShelf';
import {BinderWindow, type BinderWindowProps} from './BinderWindow';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const writes = vi.hoisted(() => ({
  createBinder: vi.fn<(make: {readerId: string; input: unknown}) => Promise<CreateResult>>(),
  updateBinder: vi.fn<(change: {readerId: string; id: string; patch: unknown}) => Promise<UpdateResult>>(),
}));
vi.mock('./binderShelf', () => writes);

const cardOf = (facts: Partial<LorcanaCard> & Pick<LorcanaCard, 'id'>) =>
  ({name: facts.id, fullName: facts.id, cost: 1, ink: 'Amber', inkwell: true, type: 'Character', rarity: 'Common', setCode: '12', setNumber: 1, ...facts}) as LorcanaCard;

const POOL = [
  cardOf({id: 'amber-common', setNumber: 3}),
  cardOf({id: 'amber-epic', rarity: 'Epic', setNumber: 210}),
  cardOf({id: 'steel-rare', ink: 'Steel', rarity: 'Rare', setCode: '11', setNumber: 8}),
];
const ENTRIES: CollectionEntries = {'amber-epic': {normal: 1, foil: 0}};

const EPICS: Binder = {id: 'b1', name: 'Epics', scope: 'all', rules: 'rarity=Epic', pages: 4, cover: null, place: 0};
const MADE: Binder = {id: 'b2', name: 'Amber', scope: 'all', rules: 'ink=Amber', pages: 4, cover: null, place: 1};

function renderWindow(over: Partial<BinderWindowProps> = {}) {
  const props: BinderWindowProps = {
    isOpen: true,
    binder: null,
    pool: POOL,
    entries: ENTRIES,
    readerId: 'user-1',
    isMobile: false,
    onSaved: vi.fn(),
    onClose: vi.fn(),
    onGone: vi.fn(),
    ...over,
  };
  render(<BinderWindow {...props} />);
  return props;
}

const button = (name: string | RegExp) => screen.getByRole('button', {name});
const nameField = () => screen.getByRole('textbox', {name: 'Name'});

/** Names the binder Amber and picks the Amber ink: two cards. */
function fillAmber() {
  fireEvent.change(nameField(), {target: {value: 'Amber'}});
  fireEvent.click(button('Filter by Amber'));
}

/** A save the test lands when it says, so it can look at the window while it runs. */
function heldSave<T>(mock: {mockReturnValue: (value: Promise<T>) => unknown}) {
  let land!: (result: T) => void;
  mock.mockReturnValue(new Promise<T>((resolve) => (land = resolve)));
  return (result: T) => act(async () => land(result));
}

describe('BinderWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.createBinder.mockResolvedValue({binder: MADE});
    writes.updateBinder.mockResolvedValue({binder: EPICS});
  });

  it('creates nothing until it has a name and a card, then creates the binder and counts it by its rules', async () => {
    const props = renderWindow();
    expect(screen.getByRole('dialog', {name: 'New binder'})).toBeInTheDocument();
    expect(button('Create binder')).toBeDisabled();
    fillAmber();
    expect(screen.getByText('2 cards')).toBeInTheDocument();
    await act(async () => fireEvent.click(button('Create binder')));
    expect(writes.createBinder).toHaveBeenCalledWith({
      readerId: 'user-1',
      input: {name: 'Amber', scope: 'all', rules: 'ink=Amber', cover: null},
    });
    expect(trackEvent).toHaveBeenCalledWith('binder_created', {from: 'window', kinds: 'ink'});
    expect(props.onSaved).toHaveBeenCalledWith(MADE);
  });

  it('makes the binder in the design picked under its cover, Starry night unless one is', async () => {
    renderWindow();
    expect(button('Starry night')).toHaveAttribute('aria-pressed', 'true');
    fillAmber();
    fireEvent.click(button('Tartan'));
    expect(button('Tartan')).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-cover]')).toHaveAttribute('data-cover', 'tartan');
    await act(async () => fireEvent.click(button('Create binder')));
    expect(writes.createBinder).toHaveBeenCalledWith({
      readerId: 'user-1',
      input: {name: 'Amber', scope: 'all', rules: 'ink=Amber', cover: 'tartan'},
    });
  });

  it("saves a new design alone as Edit rules' change, and counts it as the cover's", async () => {
    renderWindow({binder: EPICS});
    fireEvent.click(button('Argyle'));
    await act(async () => fireEvent.click(button('Save changes')));
    expect(writes.updateBinder).toHaveBeenCalledWith({
      readerId: 'user-1',
      id: 'b1',
      patch: {name: 'Epics', scope: 'all', rules: 'rarity=Epic', cover: 'argyle'},
    });
    expect(trackEvent).toHaveBeenCalledWith('binder_changed', {what: 'cover'});
  });

  it('offers the designs as a Cover row in the rules on a phone', () => {
    renderWindow({isMobile: true});
    expect(screen.getAllByRole('list', {name: 'Covers'})).toHaveLength(1);
    expect(screen.getByText('Cover')).toBeInTheDocument();
  });

  it("says rules that hold no card, and keeps Create binder off", () => {
    renderWindow();
    fillAmber();
    fireEvent.click(button('Filter by Amber'));
    fireEvent.click(button('Filter by Ruby'));
    expect(screen.getByText('0 cards')).toBeInTheDocument();
    expect(screen.getByText('No card matches these rules.')).toBeInTheDocument();
    expect(button('Create binder')).toBeDisabled();
  });

  it('draws a 30-letter name on the preview cover, and keeps every name out of attributes and autocapture', () => {
    renderWindow();
    const long = 'The Lands of Sapphire and Gold';
    fireEvent.change(nameField(), {target: {value: `${long}!`}});
    expect(nameField()).toHaveValue(long);
    const dialog = screen.getByRole('dialog', {name: 'New binder'});
    expect(within(dialog).getAllByText(long).length).toBeGreaterThan(0);
    expect(dialog.querySelector('.ph-no-capture')).not.toBeNull();
    for (const element of dialog.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        if (attribute.name !== 'value') expect(attribute.value).not.toContain('Sapphire and Gold');
      }
    }
  });

  it.each([
    ['full', 'Your shelf holds 30 binders, the most it can.'],
    ['failed', "Couldn't save the binder. Try again."],
  ] as const)('says a %s shelf, keeps every pick and counts nothing', async (problem, line) => {
    writes.createBinder.mockResolvedValue({problem});
    const props = renderWindow();
    fillAmber();
    await act(async () => fireEvent.click(button('Create binder')));
    expect(screen.getByRole('alert')).toHaveTextContent(line);
    expect(nameField()).toHaveValue('Amber');
    expect(button('Create binder')).toBeEnabled();
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('waits at every way out, and holds every pick, while it saves', async () => {
    const land = heldSave(writes.createBinder);
    const props = renderWindow();
    fillAmber();
    await act(async () => fireEvent.click(button('Create binder')));
    expect(button('Saving…')).toBeDisabled();
    expect(button('Cancel')).toBeDisabled();
    expect(nameField()).toBeDisabled();
    expect(button('Filter by Ruby')).toBeDisabled();
    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.click(button('Close'));
    // The backdrop, behind the panel's own layer.
    fireEvent.click(screen.getByRole('dialog').parentElement!.previousElementSibling!);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(writes.createBinder).toHaveBeenCalledOnce();
    await land({binder: MADE});
    expect(props.onSaved).toHaveBeenCalledWith(MADE);
  });

  it("titles Edit rules by the binder's name, which stays out of the window's own, and saves only a change, its cover left alone", async () => {
    const props = renderWindow({binder: EPICS});
    expect(screen.getByRole('dialog', {name: 'Edit binder'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Edit Epics'})).toBeInTheDocument();
    expect(nameField()).toHaveValue('Epics');
    expect(button('Save changes')).toBeDisabled();
    fireEvent.click(button('Filter by Amber'));
    await act(async () => fireEvent.click(button('Save changes')));
    expect(writes.updateBinder).toHaveBeenCalledWith({
      readerId: 'user-1',
      id: 'b1',
      patch: {name: 'Epics', scope: 'all', rules: 'ink=Amber&rarity=Epic'},
    });
    expect(trackEvent).toHaveBeenCalledWith('binder_changed', {what: 'rules'});
    expect(props.onSaved).toHaveBeenCalledWith(EPICS);
  });

  it('tells a new binder what can change later, and Edit rules nothing of it', () => {
    const later = 'You can change its rules, name and cover later.';
    renderWindow();
    expect(screen.getByText(later)).toBeInTheDocument();
    cleanup();
    renderWindow({binder: EPICS});
    expect(screen.queryByText(later)).toBeNull();
  });

  it('lets the keyboard reach its preview, which scrolls with nothing in it to focus', () => {
    renderWindow();
    const preview = screen.getByRole('region', {name: 'Preview'});
    expect(preview).toHaveAttribute('tabindex', '0');
    expect(within(preview).getByText(/^\d+ cards$/)).toBeInTheDocument();
  });

  it('says why rules too long to keep turn Create binder off, though they hold a card', () => {
    const long = 'a'.repeat(1001);
    renderWindow({pool: [...POOL, cardOf({id: 'long', name: long, fullName: long})]});
    fireEvent.change(nameField(), {target: {value: 'Long'}});
    fireEvent.change(screen.getByRole('textbox', {name: 'Name has'}), {target: {value: long}});
    expect(screen.getByText('1 card')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('These rules are too long to keep. Shorten Name has.');
    expect(button('Create binder')).toBeDisabled();
  });

  it('counts a new name alone as a change of name', async () => {
    renderWindow({binder: EPICS});
    fireEvent.change(nameField(), {target: {value: 'My epics'}});
    await act(async () => fireEvent.click(button('Save changes')));
    expect(trackEvent).toHaveBeenCalledWith('binder_changed', {what: 'name'});
  });

  it('says a binder deleted elsewhere', async () => {
    writes.updateBinder.mockResolvedValue({problem: 'gone'});
    renderWindow({binder: EPICS});
    fireEvent.change(nameField(), {target: {value: 'My epics'}});
    await act(async () => fireEvent.click(button('Save changes')));
    expect(screen.getByRole('alert')).toHaveTextContent("This binder isn't on your shelf anymore.");
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("puts Cancel, the title and Create in a phone's header, and Cancel closes", () => {
    const props = renderWindow({isMobile: true});
    const sheet = screen.getByRole('dialog', {name: 'New binder'});
    const head = within(sheet).getByRole('heading', {name: 'New binder'}).parentElement!;
    expect(within(head).getAllByRole('button').map((each) => each.textContent)).toEqual(['Cancel', 'Create']);
    fireEvent.click(button('Cancel'));
    expect(props.onClose).toHaveBeenCalledOnce();
  });
});
