import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent, act} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {ImportCollectionDialog} from './ImportCollectionDialog';

const POOL = [{id: 'c1', name: 'Card', setCode: '1', setNumber: 1} as unknown as LorcanaCard];
const CSV = 'Set Number,Card Number,Variant,Count,Name,Color,Rarity\n001,1,normal,2,"Card",Amber,Common\n';

/** Hand a file to the hidden input the way the browser's picker would. */
function pick(contents: string) {
  const input = screen.getByLabelText('Collection CSV file') as HTMLInputElement;
  const file = new File([contents], 'export.csv', {type: 'text/csv'});
  fireEvent.change(input, {target: {files: [file]}});
}

describe('ImportCollectionDialog', () => {
  it('refuses to parse while the pool is incomplete, even through the input itself', async () => {
    // The button is disabled, but the input stays drivable: the guard must sit in
    // the import funnel, or a partial pool silently drops the cards it cannot see.
    const onImport = vi.fn(() => null);
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady={false} poolError={null} onRetryPool={vi.fn()} onImport={onImport} />);
    await act(async () => pick(CSV));
    expect(onImport).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/still loading/i);
  });

  it('imports once the pool is ready, and shows the receipt', async () => {
    const onImport = vi.fn(() => null);
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={onImport} />);
    await act(async () => pick(CSV));
    expect(onImport).toHaveBeenCalledWith({c1: {normal: 2, foil: 0}}, expect.any(Number));
    expect(await screen.findByText('Collection imported')).toBeInTheDocument();
  });

  it('a cancel while the file is still being read imports nothing', async () => {
    const onImport = vi.fn(() => null);
    render(<ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={onImport} />);
    let release: (text: string) => void = () => {};
    const slow = new File([CSV], 'export.csv', {type: 'text/csv'});
    slow.text = () => new Promise((resolve) => (release = resolve));
    const input = screen.getByLabelText('Collection CSV file') as HTMLInputElement;
    fireEvent.change(input, {target: {files: [slow]}});

    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await act(async () => release(CSV));
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
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the collection (HTTP 503).');
    fireEvent.click(screen.getByRole('button', {name: 'Try again'}));
    expect(onRetryPool).toHaveBeenCalledTimes(1);
  });

  it('hands focus to Done once the receipt replaces the file step', async () => {
    render(
      <ImportCollectionDialog isOpen onClose={vi.fn()} pool={POOL} isPoolReady poolError={null} onRetryPool={vi.fn()} onImport={vi.fn(() => null)} />,
    );
    await act(async () => pick(CSV));
    expect(screen.getByRole('button', {name: 'Done'})).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Collection imported: 1 card.');
  });
});
