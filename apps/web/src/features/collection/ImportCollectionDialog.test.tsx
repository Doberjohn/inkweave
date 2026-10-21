import {beforeEach, describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent, act, type RenderResult} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {trackEvent} from '../../shared/lib/analytics';
import {ImportCollectionDialog, type ImportContext} from './ImportCollectionDialog';

vi.mock('../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));

const POOL = [{id: 'c1', name: 'Card', setCode: '1', setNumber: 1} as unknown as LorcanaCard];
const CSV = 'Set Number,Card Number,Variant,Count,Name,Color,Rarity\n001,1,normal,2,"Card",Amber,Common\n';
const CONTEXT: ImportContext = {surface: 'account', replacing: true};

/** Hand a file to the hidden input the way the browser's picker would. */
function pick(contents: string) {
  const input = screen.getByLabelText('Collection CSV file') as HTMLInputElement;
  const file = new File([contents], 'export.csv', {type: 'text/csv'});
  fireEvent.change(input, {target: {files: [file]}});
}

/**
 * Pick a file whose read waits for the returned call, so a test can act mid-read.
 * It throws if the dialog never started the read: then "nothing imported" would hold
 * for the wrong reason.
 */
function pickSlowly(): () => Promise<void> {
  let release: ((text: string) => void) | null = null;
  const file = new File([CSV], 'export.csv', {type: 'text/csv'});
  file.text = () => new Promise((resolve) => (release = resolve));
  fireEvent.change(screen.getByLabelText('Collection CSV file'), {target: {files: [file]}});
  return () => {
    const finish = release;
    if (finish === null) throw new Error('The dialog never read the file.');
    return act(async () => finish(CSV));
  };
}

describe('ImportCollectionDialog', () => {
  it('warns that an import replaces counts changed in the app too (#826)', () => {
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={vi.fn(() => null)} context={CONTEXT} />);
    expect(screen.getByText(/replaces whatever collection Inkweave already has, counts you changed in the app included/)).toBeInTheDocument();
  });

  it('refuses to parse while the pool is incomplete, even through the input itself', async () => {
    // The button is disabled, but the input stays drivable: the guard must sit in
    // the import funnel, or a partial pool silently drops the cards it cannot see.
    const onImport = vi.fn(() => null);
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady={false} poolError={null} onRetryPool={vi.fn()} onImport={onImport} context={CONTEXT} />);
    await act(async () => pick(CSV));
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/still loading/i);
  });

  it('imports once the pool is ready, and shows the receipt', async () => {
    const onImport = vi.fn(() => null);
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={onImport} context={CONTEXT} />);
    await act(async () => pick(CSV));
    expect(onImport).toHaveBeenCalledWith({c1: {normal: 2, foil: 0}}, expect.any(Number));
    expect(await screen.findByText('Collection imported')).toBeInTheDocument();
  });

  it('gives a row two printings share its own reason, apart from rows that match nothing', async () => {
    // #553: such a row is left out on purpose, and "could not be matched" would misstate why.
    const pool = [
      ...POOL,
      ...['p1', 'p2'].map((id) => ({id, name: 'Puppy', setCode: '3', setNumber: 4}) as unknown as LorcanaCard),
    ];
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={pool} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={vi.fn(() => null)} context={CONTEXT} />);
    await act(async () => pick(`${CSV}003,4b,normal,1,"Puppy",Amber,Common\n014,7,normal,1,"Next Set",Steel,Rare\n`));
    expect(screen.getByText(/more than one printing/)).toHaveTextContent('3-4b');
    expect(screen.getByText(/could not be matched/)).not.toHaveTextContent('3-4b');
  });

  const interruptions: [string, (view: RenderResult) => void][] = [
    ['a cancel', () => fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))],
    ['leaving the page', (view) => view.unmount()],
  ];
  it.each(interruptions)('%s while the file is still being read imports nothing', async (_, interrupt) => {
    const onImport = vi.fn(() => null);
    const view = render(
      <ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={onImport} context={CONTEXT} />,
    );
    const finishReading = pickSlowly();
    interrupt(view);
    await finishReading();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('says why the card list failed to load, and retries it from the dialog', () => {
    // Outside collection mode nothing else shows this error: the dialog is the only way out.
    const onRetryPool = vi.fn();
    render(
      <ImportCollectionDialog
        isOpen
        onClose={vi.fn()}
        pool={POOL}
        isPoolReady={false}
        poolError="Could not load the collection (HTTP 503)."
        onRetryPool={onRetryPool}
        onImport={vi.fn(() => null)}
        context={CONTEXT}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the collection (HTTP 503).');
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    expect(onRetryPool).toHaveBeenCalledTimes(1);
  });

  it('hands focus to Done once the receipt replaces the file step', async () => {
    render(
      <ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={vi.fn(() => null)} context={CONTEXT} />,
    );
    await act(async () => pick(CSV));
    expect(screen.getByRole('button', {name: 'Done'})).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Collection imported: 1 card.');
  });
});

describe('ImportCollectionDialog analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** A file the browser cannot read: its `text()` rejects. */
  function pickUnreadable() {
    const file = new File([CSV], 'export.csv', {type: 'text/csv'});
    file.text = () => Promise.reject(new Error('The file is gone.'));
    fireEvent.change(screen.getByLabelText('Collection CSV file'), {target: {files: [file]}});
  }

  it('sends the receipt as counts with the context, never its refs, rows or file name', async () => {
    const pool = [
      ...POOL,
      ...['p1', 'p2'].map((id) => ({id, name: 'Puppy', setCode: '3', setNumber: 4}) as unknown as LorcanaCard),
    ];
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={pool} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={vi.fn(() => null)} context={CONTEXT} />);
    await act(async () => pick(`${CSV}003,4b,normal,1,"Puppy",Amber,Common\n014,7,normal,1,"Next Set",Steel,Rare\nnot,a,row\n`));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('collection_imported', {
      surface: 'account',
      replacing: true,
      cards: 1,
      copies: 2,
      unidentified: 1,
      ambiguous: 1,
      unparsed: 1,
    });
    const sent = JSON.stringify(vi.mocked(trackEvent).mock.calls);
    for (const contents of ['3-4b', '14-7', 'not,a,row', 'export.csv']) expect(sent).not.toContain(contents);
  });

  // Each of the import's four refusals: the pool still loading, a file the browser can't read,
  // a file with nothing owned (every count 0), and a save the collection refuses.
  const refusals: {reason: string; isPoolReady: boolean; onImport: () => string | null; attempt: () => void}[] = [
    {reason: 'not_ready', isPoolReady: false, onImport: () => null, attempt: () => pick(CSV)},
    {reason: 'unreadable', isPoolReady: true, onImport: () => null, attempt: pickUnreadable},
    {reason: 'no_cards', isPoolReady: true, onImport: () => null, attempt: () => pick(CSV.replace(',2,', ',0,'))},
    {reason: 'storage', isPoolReady: true, onImport: () => 'Your collection could not be saved.', attempt: () => pick(CSV)},
  ];
  it.each(refusals)('sends one $reason failure with the context', async ({reason, isPoolReady, onImport, attempt}) => {
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady={isPoolReady} poolError={null} onRetryPool={vi.fn()} onImport={vi.fn(onImport)} context={CONTEXT} />);
    await act(async () => attempt());

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('collection_import_failed', {...CONTEXT, reason});
  });

  it('sends nothing for a read the reader cancels', async () => {
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={vi.fn(() => null)} context={CONTEXT} />);
    const finishReading = pickSlowly();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await finishReading();

    expect(trackEvent).not.toHaveBeenCalled();
  });
});
