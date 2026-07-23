import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {TabList} from '../TabList';

const TABS = [
  {id: 'cards', label: 'Cards'},
  {id: 'analysis', label: 'Analysis'},
] as const;

describe('TabList', () => {
  it('renders an ARIA tablist with the active tab selected and focusable', () => {
    render(<TabList tabs={TABS} active="cards" onChange={() => {}} ariaLabel="Panel views" />);
    expect(screen.getByRole('tablist', {name: 'Panel views'})).toBeInTheDocument();
    const cards = screen.getByRole('tab', {name: 'Cards'});
    const analysis = screen.getByRole('tab', {name: 'Analysis'});
    expect(cards).toHaveAttribute('aria-selected', 'true');
    expect(cards).toHaveAttribute('tabindex', '0');
    expect(analysis).toHaveAttribute('aria-selected', 'false');
    expect(analysis).toHaveAttribute('tabindex', '-1');
  });

  it('clicking a tab reports its id', () => {
    const onChange = vi.fn();
    render(<TabList tabs={TABS} active="cards" onChange={onChange} ariaLabel="Panel views" />);
    fireEvent.click(screen.getByRole('tab', {name: 'Analysis'}));
    expect(onChange).toHaveBeenCalledWith('analysis');
  });

  it('ArrowRight moves selection and wraps at the end', () => {
    const onChange = vi.fn();
    render(<TabList tabs={TABS} active="analysis" onChange={onChange} ariaLabel="Panel views" />);
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Analysis'}), {key: 'ArrowRight'});
    expect(onChange).toHaveBeenCalledWith('cards'); // wrapped
  });

  it('ArrowLeft moves selection backward', () => {
    const onChange = vi.fn();
    render(<TabList tabs={TABS} active="analysis" onChange={onChange} ariaLabel="Panel views" />);
    fireEvent.keyDown(screen.getByRole('tab', {name: 'Analysis'}), {key: 'ArrowLeft'});
    expect(onChange).toHaveBeenCalledWith('cards');
  });
});
