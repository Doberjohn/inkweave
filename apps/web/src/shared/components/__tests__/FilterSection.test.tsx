import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {FilterSection} from '../FilterSection';

const body = <button type="button">Character</button>;

describe('FilterSection', () => {
  it('is always open when it is not collapsible', () => {
    render(<FilterSection label="Type">{body}</FilterSection>);
    expect(screen.getByRole('button', {name: 'Character'})).toBeVisible();
    expect(screen.queryByRole('button', {name: /Type/})).toBeNull();
  });

  it('starts folded, with what is selected inside shown in its header', () => {
    render(
      <FilterSection label="Type" collapsible={{defaultOpen: false}} summary="Character">
        {body}
      </FilterSection>,
    );
    const header = screen.getByRole('button', {name: /Type/});
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(header).toHaveTextContent('· Character');
    expect(screen.queryByRole('button', {name: 'Character'})).toBeNull();
  });

  it('washes its header line while the pointer is on it, so the line reads as the toggle', () => {
    render(
      <FilterSection label="Type" collapsible={{defaultOpen: false}}>
        {body}
      </FilterSection>,
    );
    const header = screen.getByRole('button', {name: /Type/});
    expect(header.style.background).toBe('transparent');
    fireEvent.mouseEnter(header);
    expect(header.style.background).not.toBe('transparent');
    fireEvent.mouseLeave(header);
    expect(header.style.background).toBe('transparent');
  });

  it('keeps an action on its header line apart from the toggle, so clicking it folds nothing', () => {
    const onClearAll = vi.fn();
    const clearAll = (
      <button type="button" onClick={onClearAll}>
        Clear all
      </button>
    );
    render(
      <FilterSection label="Ink" collapsible={{defaultOpen: true}} action={clearAll}>
        {body}
      </FilterSection>,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Clear all'}));
    expect(onClearAll).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', {name: 'Ink'})).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens from its header, and drops the summary once its contents show', () => {
    render(
      <FilterSection label="Type" collapsible={{defaultOpen: false}} summary="Character">
        {body}
      </FilterSection>,
    );
    fireEvent.click(screen.getByRole('button', {name: /Type/}));
    expect(screen.getByRole('button', {name: /Type/})).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', {name: /Type/})).not.toHaveTextContent('Character');
    expect(screen.getByRole('button', {name: 'Character'})).toBeVisible();
  });
});
