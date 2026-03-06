import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {SearchAutocomplete} from '../SearchAutocomplete';
import {CardPreviewProvider} from '../../../features/cards/components/CardPreviewContext';
import type {LorcanaCard} from 'inkweave-synergy-engine';

const makeCard = (
  id: string,
  fullName: string,
  ink = 'Amethyst' as const,
  cost = 3,
  setCode = '5',
): LorcanaCard =>
  ({
    id,
    name: fullName.split(' - ')[0],
    fullName,
    cost,
    ink,
    inkwell: true,
    type: 'Character',
    setCode,
  }) as LorcanaCard;

const suggestions = [
  makeCard('1', 'Elsa - Snow Queen', 'Sapphire', 5, '9'),
  makeCard('2', 'Elsa - Ice Surfer', 'Amethyst', 3, '5'),
];

const defaultProps = {
  suggestions,
  isOpen: true,
  highlightedIndex: -1,
  query: 'Elsa',
  listboxProps: {id: 'test-listbox', role: 'listbox' as const},
  getOptionProps: (index: number) => ({
    id: `option-${index}`,
    role: 'option' as const,
    'aria-selected': false,
    onMouseDown: vi.fn(),
    onMouseEnter: vi.fn(),
  }),
};

function renderWithProvider(ui: React.ReactElement) {
  return render(<CardPreviewProvider>{ui}</CardPreviewProvider>);
}

describe('SearchAutocomplete', () => {
  it('does not render when isOpen is false', () => {
    const {container} = renderWithProvider(<SearchAutocomplete {...defaultProps} isOpen={false} />);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('renders suggestion items when open', () => {
    renderWithProvider(<SearchAutocomplete {...defaultProps} />);
    expect(screen.getByText(/Snow Queen/)).toBeInTheDocument();
    expect(screen.getByText(/Ice Surfer/)).toBeInTheDocument();
  });

  it('highlights matching text in gold', () => {
    renderWithProvider(<SearchAutocomplete {...defaultProps} />);
    const marks = document.querySelectorAll('mark');
    expect(marks).toHaveLength(2);
    expect(marks[0].textContent).toBe('Elsa');
  });

  it('shows set abbreviation with tooltip for each suggestion', () => {
    renderWithProvider(<SearchAutocomplete {...defaultProps} />);
    expect(screen.getByText('9FAB')).toBeInTheDocument();
    expect(screen.getByText('5SSK')).toBeInTheDocument();
    // Tooltip shows full set name
    expect(screen.getByText('9FAB').getAttribute('title')).toBe('Fabled');
    expect(screen.getByText('5SSK').getAttribute('title')).toBe('Shimmering Skies');
  });

  it('has correct ARIA attributes', () => {
    renderWithProvider(<SearchAutocomplete {...defaultProps} />);
    const listbox = document.getElementById('test-listbox');
    expect(listbox).toBeInTheDocument();
    expect(listbox?.getAttribute('role')).toBe('listbox');
  });
});
