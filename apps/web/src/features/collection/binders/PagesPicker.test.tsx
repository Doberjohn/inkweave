import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {trackEvent} from '../../../shared/lib/analytics';
import type {ShelfLook} from './binderRepository';
import {PagesPicker, type PagesPickerProps} from './PagesPicker';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const writes = vi.hoisted(() => ({
  setMyCollection: vi.fn<(change: {readerId: string; patch: Partial<ShelfLook>}) => Promise<boolean>>(),
}));
vi.mock('./binderShelf', () => writes);

function renderPicker(over: Partial<PagesPickerProps> = {}) {
  const props: PagesPickerProps = {
    isOpen: true,
    pages: 4,
    readerId: 'user-1',
    isMobile: false,
    onSaved: vi.fn(),
    onClose: vi.fn(),
    onGone: vi.fn(),
    ...over,
  };
  render(<PagesPicker {...props} />);
  return props;
}

const choices = () => within(screen.getByRole('list', {name: 'Pages'})).getAllByRole('button');
const choice = (side: number) => screen.getByRole('button', {name: `${side} × ${side}, ${side * side} a page`});
const chosen = () => choices().filter((button) => button.getAttribute('aria-pressed') === 'true');

describe('PagesPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.setMyCollection.mockResolvedValue(true);
  });

  it("offers the three sizes, smallest first, My collection's own marked", () => {
    renderPicker({pages: 3});
    expect(screen.getByRole('dialog', {name: 'Pages'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Pages for My collection'})).toBeInTheDocument();
    expect(choices()).toEqual([choice(2), choice(3), choice(4)]);
    expect(chosen()).toEqual([choice(3)]);
  });

  it("saves a pick as My collection's pages, counts the change, and tells the shelf once it lands", async () => {
    const props = renderPicker();
    await act(async () => fireEvent.click(choice(2)));
    expect(writes.setMyCollection).toHaveBeenCalledExactlyOnceWith({readerId: 'user-1', patch: {pages: 2}});
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('binder_changed', {what: 'pages'});
    expect(props.onSaved).toHaveBeenCalledOnce();
  });

  it('only closes when the size picked is the one it has', () => {
    const props = renderPicker();
    fireEvent.click(choice(4));
    expect(writes.setMyCollection).not.toHaveBeenCalled();
    expect(props.onSaved).toHaveBeenCalledOnce();
  });

  it('holds while the pick saves: every choice and Cancel wait, and Escape does nothing', async () => {
    let land!: (saved: boolean) => void;
    writes.setMyCollection.mockReturnValue(new Promise((resolve) => (land = resolve)));
    const props = renderPicker();
    await act(async () => fireEvent.click(choice(3)));
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    for (const button of choices()) expect(button).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => land(true));
  });

  it('stays open and says so when the save fails', async () => {
    writes.setMyCollection.mockResolvedValue(false);
    const props = renderPicker();
    await act(async () => fireEvent.click(choice(3)));
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't change the page size. Try again.");
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("draws a phone's sheet", () => {
    renderPicker({isMobile: true});
    expect(screen.getByRole('dialog', {name: 'Pages'})).toHaveClass('overlay-slide-up');
  });
});
