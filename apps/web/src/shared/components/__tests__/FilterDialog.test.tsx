import {useState} from 'react';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import type {Ink} from '../../../features/cards';
import type {CardTypeFilter} from '../../constants';
import {FilterDialog} from '../FilterDialog';

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onApply: vi.fn(),
  inkFilters: [] as Ink[],
  typeFilters: [] as CardTypeFilter[],
  costFilters: [] as number[],
  filters: {},
  uniqueKeywords: ['Singer', 'Evasive', 'Ward'],
  uniqueClassifications: ['Princess', 'Hero', 'Villain'],
  uniqueRarities: ['Common', 'Rare'],
  sets: [
    {code: '1', name: 'The First Chapter', number: 1},
    {code: '5', name: 'Shimmering Skies', number: 5},
    {code: '10', name: 'Set Ten', number: 10},
  ],
};

describe.each(['modal', 'drawer'] as const)('FilterDialog variant=%s', (variant) => {
  const testId = variant === 'modal' ? 'filter-modal' : 'filter-drawer';
  // The modal is the desktop variant, which has no ink buttons: desktop shows the ink filters in
  // the toolbar instead (FilterContent renders its ink section on mobile only). So the three ink
  // tests below run on the drawer only.

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    render(<FilterDialog {...defaultProps} variant={variant} isOpen={false} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render filter title when open', () => {
    render(<FilterDialog {...defaultProps} variant={variant} />);
    expect(screen.getByRole('heading', {name: /filters/i})).toBeInTheDocument();
  });

  it.skipIf(variant === 'modal')('should render all ink filter buttons', () => {
    render(<FilterDialog {...defaultProps} variant={variant} />);

    for (const ink of ['amber', 'amethyst', 'emerald', 'ruby', 'sapphire', 'steel']) {
      expect(screen.getByRole('button', {name: new RegExp(ink, 'i')})).toBeInTheDocument();
    }
  });

  it('should render card type filter buttons', () => {
    render(<FilterDialog {...defaultProps} variant={variant} />);

    for (const type of ['character', 'action', 'item', 'location']) {
      expect(screen.getByRole('button', {name: new RegExp(type, 'i')})).toBeInTheDocument();
    }
  });

  it.skipIf(variant === 'modal')('should toggle ink in draft state without calling onApply', () => {
    render(<FilterDialog {...defaultProps} variant={variant} />);

    fireEvent.click(screen.getByRole('button', {name: /amber/i}));

    expect(defaultProps.onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'true');
  });

  it('should call onApply with draft state when clicking Apply button', () => {
    const onApply = vi.fn();
    render(<FilterDialog {...defaultProps} variant={variant} onApply={onApply} />);

    // Modal doesn't show ink buttons (they're inline in toolbar), so only toggle type
    if (variant === 'drawer') {
      fireEvent.click(screen.getByRole('button', {name: /amber/i}));
    }
    fireEvent.click(screen.getByRole('button', {name: /character/i}));
    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    if (variant === 'drawer') {
      expect(onApply).toHaveBeenCalledWith(['Amber'], ['Character'], [], {});
    } else {
      expect(onApply).toHaveBeenCalledWith([], ['Character'], [], {});
    }
  });

  it('should call onClose when clicking Apply button', () => {
    const onClose = vi.fn();
    render(<FilterDialog {...defaultProps} variant={variant} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onClose).toHaveBeenCalled();
  });

  it('should close on Escape key (discards draft)', () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    render(
      <FilterDialog {...defaultProps} variant={variant} onClose={onClose} onApply={onApply} />,
    );

    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Escape'});

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('should hand focus back to the control that opened it on close', async () => {
    // Controlled, with no Dialog.Trigger: Radix's own return target is null (WCAG 2.4.3).
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Filters
          </button>
          <FilterDialog {...defaultProps} variant={variant} isOpen={open} onClose={() => setOpen(false)} />
        </>
      );
    }
    render(<Page />);
    const opener = screen.getByRole('button', {name: 'Filters'});
    opener.focus();
    fireEvent.click(opener);

    fireEvent.keyDown(await screen.findByRole('dialog'), {key: 'Escape'});

    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('should show Clear all button when draft filters are active', () => {
    render(<FilterDialog {...defaultProps} variant={variant} inkFilters={['Amber']} />);
    expect(screen.getByRole('button', {name: /clear all/i})).toBeInTheDocument();
  });

  it('should not show Clear all button when no filters are active', () => {
    render(<FilterDialog {...defaultProps} variant={variant} />);
    expect(screen.queryByRole('button', {name: /clear all/i})).not.toBeInTheDocument();
  });

  it('should clear draft state when clicking Clear all', () => {
    render(
      <FilterDialog
        {...defaultProps}
        variant={variant}
        inkFilters={['Amber']}
        typeFilters={['Character']}
      />,
    );

    // Modal doesn't show ink buttons; verify via type button instead
    if (variant === 'drawer') {
      expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'true');
    }
    expect(screen.getByRole('button', {name: /character/i})).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', {name: /clear all/i}));

    if (variant === 'drawer') {
      expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
    expect(screen.getByRole('button', {name: /character/i})).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('should show active filter count in title', () => {
    render(
      <FilterDialog
        {...defaultProps}
        variant={variant}
        inkFilters={['Amber']}
        typeFilters={['Character']}
      />,
    );

    expect(screen.getByText(/filters \(2\)/i)).toBeInTheDocument();
  });

  it.skipIf(variant === 'modal')('should mark current ink as active from draft state', () => {
    render(<FilterDialog {...defaultProps} variant={variant} inkFilters={['Ruby']} />);

    expect(screen.getByRole('button', {name: /ruby/i})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'false');
  });

  it('should toggle type in draft state', () => {
    render(<FilterDialog {...defaultProps} variant={variant} />);

    fireEvent.click(screen.getByRole('button', {name: /character/i}));

    expect(screen.getByRole('button', {name: /character/i})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(defaultProps.onApply).not.toHaveBeenCalled();
  });

  it('should collect several draft keywords from their chips', () => {
    const onApply = vi.fn();
    render(<FilterDialog {...defaultProps} variant={variant} onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', {name: 'Singer'}));
    fireEvent.click(screen.getByRole('button', {name: 'Ward'}));
    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onApply).toHaveBeenCalledWith([], [], [], {keywords: ['Singer', 'Ward']});
  });

  it('should have correct ARIA attributes', () => {
    render(<FilterDialog {...defaultProps} variant={variant} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('should have the correct data-testid', () => {
    render(<FilterDialog {...defaultProps} variant={variant} />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('should count all active draft filters correctly', () => {
    render(
      <FilterDialog
        {...defaultProps}
        variant={variant}
        inkFilters={['Amber']}
        typeFilters={['Character']}
        costFilters={[2, 5]}
        filters={{
          keywords: ['Singer', 'Ward'],
          classifications: ['Princess'],
          setCodes: ['5', '6'],
        }}
      />,
    );

    // Every picked value counts: 1 ink + 1 type + 2 costs + 2 keywords + 1
    // classification + 2 sets. Counting each list as one gave 7.
    expect(screen.getByText(/filters \(9\)/i)).toBeInTheDocument();
  });
});

describe('FilterDialog modal-specific', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render close button on modal variant', () => {
    render(<FilterDialog {...defaultProps} variant="modal" />);
    expect(screen.getByRole('button', {name: /close filters/i})).toBeInTheDocument();
  });

  it('should render Apply Filters in footer on modal variant', () => {
    render(<FilterDialog {...defaultProps} variant="modal" />);
    expect(screen.getByRole('button', {name: /apply filters/i})).toBeInTheDocument();
  });

  it('should focus the close button when modal opens', async () => {
    render(<FilterDialog {...defaultProps} variant="modal" />);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: /close filters/i})).toHaveFocus();
    });
  });
});

describe('FilterDialog drawer-specific', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render drag handle on drawer variant', () => {
    render(<FilterDialog {...defaultProps} variant="drawer" />);
    expect(screen.getByTestId('filter-drawer')).toBeInTheDocument();
  });

  it('should not render close button on drawer variant', () => {
    render(<FilterDialog {...defaultProps} variant="drawer" />);
    expect(screen.queryByRole('button', {name: /close filters/i})).not.toBeInTheDocument();
  });

  it('should have Apply button in header on drawer variant', () => {
    render(<FilterDialog {...defaultProps} variant="drawer" />);
    expect(screen.getByRole('button', {name: /apply/i})).toBeInTheDocument();
  });
});

describe("FilterDialog with a caller's own controls (the Binder sheet, #969)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('takes a title in place of "Filters (n)"', () => {
    render(<FilterDialog {...defaultProps} variant="drawer" title="Binder" inkFilters={['Amber']} />);

    expect(screen.getByRole('heading', {name: 'Binder'})).toBeInTheDocument();
    expect(screen.queryByText(/filters \(1\)/i)).not.toBeInTheDocument();
  });

  it('draws the prelude above the filters and the postlude after them', () => {
    render(
      <FilterDialog
        {...defaultProps}
        variant="drawer"
        prelude={<p>Before the filters</p>}
        postlude={<p>After the filters</p>}
      />,
    );

    const type = screen.getByRole('button', {name: /character/i});
    const before = screen.getByText('Before the filters');
    const after = screen.getByText('After the filters');
    expect(before.compareDocumentPosition(type) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(after.compareDocumentPosition(type) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("shows Clear all for the caller's own changes alone, and its press clears them and the filters", () => {
    const onClearAll = vi.fn();
    render(<FilterDialog {...defaultProps} variant="drawer" extraCount={1} onClearAll={onClearAll} />);
    // No filter on yet: the caller's change alone shows it.
    const clear = screen.getByRole('button', {name: /clear all/i});
    fireEvent.click(screen.getByRole('button', {name: /character/i}));

    fireEvent.click(clear);

    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', {name: /character/i})).toHaveAttribute('aria-pressed', 'false');
  });
});
