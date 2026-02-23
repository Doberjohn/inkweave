import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {SearchAutocomplete} from '../SearchAutocomplete';
import type {LorcanaCard} from 'lorcana-synergy-engine';

const makeCard = (id: string, fullName: string, ink = 'Amethyst' as const, cost = 3): LorcanaCard =>
  ({id, name: fullName.split(' - ')[0], fullName, cost, ink, inkwell: true, type: 'Character'}) as LorcanaCard;

const suggestions = [
  makeCard('1', 'Elsa - Snow Queen', 'Sapphire', 5),
  makeCard('2', 'Elsa - Ice Surfer', 'Amethyst', 3),
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

describe('SearchAutocomplete', () => {
  it('does not render when isOpen is false', () => {
    const {container} = render(<SearchAutocomplete {...defaultProps} isOpen={false} />);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it('renders suggestion items when open', () => {
    render(<SearchAutocomplete {...defaultProps} />);
    expect(screen.getByText(/Snow Queen/)).toBeInTheDocument();
    expect(screen.getByText(/Ice Surfer/)).toBeInTheDocument();
  });

  it('highlights matching text in gold', () => {
    render(<SearchAutocomplete {...defaultProps} />);
    const marks = document.querySelectorAll('mark');
    expect(marks).toHaveLength(2); // One per suggestion
    expect(marks[0].textContent).toBe('Elsa');
  });

  it('shows ink color dot for each suggestion', () => {
    render(<SearchAutocomplete {...defaultProps} />);
    const dots = document.querySelectorAll('[title]');
    expect(dots[0].getAttribute('title')).toBe('Sapphire');
    expect(dots[1].getAttribute('title')).toBe('Amethyst');
  });

  it('shows cost for each suggestion', () => {
    render(<SearchAutocomplete {...defaultProps} />);
    expect(screen.getByText('5⬡')).toBeInTheDocument();
    expect(screen.getByText('3⬡')).toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    render(<SearchAutocomplete {...defaultProps} />);
    const listbox = document.getElementById('test-listbox');
    expect(listbox).toBeInTheDocument();
    expect(listbox?.getAttribute('role')).toBe('listbox');
  });
});
