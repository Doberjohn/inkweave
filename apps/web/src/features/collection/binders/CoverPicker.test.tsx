import {beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {trackEvent} from '../../../shared/lib/analytics';
import type {Binder} from './binderRules';
import type {CoverResult} from './shelfStore';
import {CoverPicker, type CoverPickerProps} from './CoverPicker';

vi.mock('../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const writes = vi.hoisted(() => ({
  setCover: vi.fn<(change: {readerId: string; id: string | null; cover: string}) => Promise<CoverResult>>(),
}));
vi.mock('./shelfStore', () => writes);

const AMBER: Binder = {id: 'b1', name: 'Amber', scope: 'all', rules: 'ink=Amber', pages: 4, cover: 'sunburst', place: 0};

function renderPicker(over: Partial<CoverPickerProps> = {}) {
  const props: CoverPickerProps = {
    isOpen: true,
    binder: AMBER,
    myCover: null,
    readerId: 'user-1',
    isMobile: false,
    onSaved: vi.fn(),
    onClose: vi.fn(),
    onGone: vi.fn(),
    ...over,
  };
  render(<CoverPicker {...props} />);
  return props;
}

const choices = () => within(screen.getByRole('list', {name: 'Covers'})).getAllByRole('button');
const choice = (name: string) => screen.getByRole('button', {name});
const chosen = () => choices().filter((button) => button.getAttribute('aria-pressed') === 'true');

describe('CoverPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    writes.setCover.mockResolvedValue('set');
  });

  it("is titled by the binder's name, which stays out of the dialog's own name", () => {
    renderPicker();
    expect(screen.getByRole('dialog', {name: 'Change cover'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Cover for Amber'}).closest('.ph-no-capture')).not.toBeNull();
    expect(screen.getByText('Pick its cover.')).toBeInTheDocument();
  });

  it("offers the eight designs by name, the binder's own marked", () => {
    renderPicker();
    expect(choices().map((button) => button.textContent)).toEqual([
      'Starry night',
      'Sunburst',
      'Tartan',
      'Pinstripe',
      'Scales',
      'Argyle',
      'Honeycomb',
      'Ripples',
    ]);
    expect(chosen()).toEqual([choice('Sunburst')]);
  });

  it('marks Starry night for a design this build does not know, and a pick of it replaces that design', async () => {
    renderPicker({binder: {...AMBER, cover: 'paisley'}});
    expect(chosen()).toEqual([choice('Starry night')]);
    await act(async () => fireEvent.click(choice('Starry night')));
    expect(writes.setCover).toHaveBeenCalledExactlyOnceWith({readerId: 'user-1', id: 'b1', cover: 'starry-night'});
  });

  it("saves a pick by its design's id, counts the change, and tells the shelf once it lands", async () => {
    const props = renderPicker();
    await act(async () => fireEvent.click(choice('Tartan')));
    expect(writes.setCover).toHaveBeenCalledExactlyOnceWith({readerId: 'user-1', id: 'b1', cover: 'tartan'});
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('binder_changed', {what: 'cover'});
    expect(props.onSaved).toHaveBeenCalledOnce();
  });

  it('only closes when the design picked is the one it has', () => {
    const props = renderPicker({binder: {...AMBER, cover: null}});
    fireEvent.click(choice('Starry night'));
    expect(writes.setCover).not.toHaveBeenCalled();
    expect(props.onSaved).toHaveBeenCalledOnce();
  });

  it('holds while the pick saves: every choice and Cancel wait, and Escape does nothing', async () => {
    let land!: (result: CoverResult) => void;
    writes.setCover.mockReturnValue(new Promise((resolve) => (land = resolve)));
    const props = renderPicker();
    await act(async () => fireEvent.click(choice('Tartan')));
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    for (const button of choices()) expect(button).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => land('set'));
  });

  it.each([
    ['failed', "Couldn't change the cover. Try again."],
    ['gone', "This binder isn't on your shelf anymore."],
  ] as const)('stays open and says so when the save comes back %s', async (result, words) => {
    writes.setCover.mockResolvedValue(result);
    const props = renderPicker();
    await act(async () => fireEvent.click(choice('Tartan')));
    expect(screen.getByRole('alert')).toHaveTextContent(words);
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("changes My collection's cover, marked from the shelf's own", async () => {
    renderPicker({binder: null, myCover: 'argyle'});
    expect(screen.getByRole('heading', {name: 'Cover for My collection'})).toBeInTheDocument();
    expect(chosen()).toEqual([choice('Argyle')]);
    await act(async () => fireEvent.click(choice('Honeycomb')));
    expect(writes.setCover).toHaveBeenCalledWith({readerId: 'user-1', id: null, cover: 'honeycomb'});
  });

  it("draws a phone's sheet", () => {
    renderPicker({isMobile: true});
    expect(screen.getByRole('dialog', {name: 'Change cover'})).toHaveClass('overlay-slide-up');
  });
});
