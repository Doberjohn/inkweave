import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {SortSelect} from '../SortSelect';

const options = [
  {value: 'name', label: 'Name'},
  {value: 'cost', label: 'Cost'},
  {value: 'score', label: 'Score'},
];

describe('SortSelect', () => {
  it('should render all options', () => {
    render(<SortSelect options={options} value="name" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('should reflect the current value', () => {
    render(<SortSelect options={options} value="cost" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toHaveValue('cost');
  });

  it('should call onChange with the new value', () => {
    const onChange = vi.fn();
    render(<SortSelect options={options} value="name" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), {target: {value: 'score'}});
    expect(onChange).toHaveBeenCalledWith('score');
  });

  it('should use custom ariaLabel', () => {
    render(
      <SortSelect options={options} value="name" onChange={vi.fn()} ariaLabel="Sort synergies" />,
    );
    expect(screen.getByRole('combobox', {name: 'Sort synergies'})).toBeInTheDocument();
  });

  it('should default ariaLabel to "Sort"', () => {
    render(<SortSelect options={options} value="name" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox', {name: 'Sort'})).toBeInTheDocument();
  });
});
