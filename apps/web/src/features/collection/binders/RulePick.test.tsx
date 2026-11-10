import {afterEach, describe, expect, it, vi} from 'vitest';
import {useState} from 'react';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {RulePick} from './RulePick';

const OPTIONS = ['Hero', 'Princess', 'Storyborn', 'Villain'];

/** A dropdown that keeps its picks, as the draft does, and tells `onChange` each change. */
function Harness({start = [], onChange}: {start?: string[]; onChange?: (next: string[]) => void}) {
  const [picked, setPicked] = useState(start);
  const change = (next: string[]) => {
    setPicked(next);
    onChange?.(next);
  };
  return <RulePick label="Classification" options={OPTIONS} picked={picked} onChange={change} isMobile={false} />;
}

const opener = () => screen.getByRole('button', {name: /classification$/});
const list = () => screen.getByRole('listbox', {name: 'Classifications'});
const find = () => screen.getByRole('combobox', {name: 'Find a classification'});
const shown = () => within(list()).queryAllByRole('option').map((option) => option.textContent);

describe('RulePick', () => {
  afterEach(cleanup);

  it('opens a list of every option onto its find field, and says Any while nothing is picked', () => {
    render(<Harness />);
    expect(opener()).toHaveTextContent('Any classification');
    expect(opener()).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(opener());
    expect(opener()).toHaveAttribute('aria-expanded', 'true');
    expect(list()).toHaveAttribute('aria-multiselectable', 'true');
    expect(shown()).toEqual(OPTIONS);
    expect(find()).toHaveFocus();
  });

  it('shows each pick as a chip, keeps it in the list ticked, and a second press takes it off', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(opener());
    fireEvent.click(within(list()).getByRole('option', {name: 'Villain'}));
    fireEvent.click(within(list()).getByRole('option', {name: 'Hero'}));
    expect(onChange).toHaveBeenLastCalledWith(['Villain', 'Hero']);
    expect(within(list()).getByRole('option', {name: 'Villain'})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', {name: /^Villain/})).toBeInTheDocument();
    expect(opener()).toHaveTextContent('Add a classification');
    fireEvent.click(within(list()).getByRole('option', {name: 'Villain'}));
    expect(onChange).toHaveBeenLastCalledWith(['Hero']);
    expect(screen.queryByRole('button', {name: /^Villain/})).not.toBeInTheDocument();
  });

  it("drops a pick with its chip's × and hands focus to the button", () => {
    const onChange = vi.fn();
    render(<Harness start={['Hero', 'Princess']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', {name: /^Hero/}));
    expect(onChange).toHaveBeenCalledWith(['Princess']);
    expect(screen.queryByRole('button', {name: /^Hero/})).not.toBeInTheDocument();
    expect(opener()).toHaveFocus();
  });

  it('narrows the list to what the find field holds, any case, and says when nothing matches', () => {
    render(<Harness />);
    fireEvent.click(opener());
    fireEvent.change(find(), {target: {value: 'IN'}});
    expect(shown()).toEqual(['Princess', 'Villain']);
    fireEvent.change(find(), {target: {value: 'dragon'}});
    expect(shown()).toEqual([]);
    expect(screen.getByText('No classification matches')).toBeInTheDocument();
  });

  it('moves the highlight with the arrows and picks it with Enter, keeping the focus in the find field', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(opener(), {key: 'ArrowDown'});
    expect(find()).toHaveFocus();
    fireEvent.keyDown(find(), {key: 'ArrowDown'});
    fireEvent.keyDown(find(), {key: 'ArrowDown'});
    fireEvent.keyDown(find(), {key: 'ArrowUp'});
    const princess = within(list()).getByRole('option', {name: 'Princess'});
    expect(find()).toHaveAttribute('aria-activedescendant', princess.id);
    fireEvent.keyDown(find(), {key: 'Enter'});
    expect(onChange).toHaveBeenCalledWith(['Princess']);
    expect(find()).toHaveFocus();
  });

  it('closes on Escape onto its button, and keeps the Escape from the window around it', () => {
    const onWindowKey = vi.fn();
    document.addEventListener('keydown', onWindowKey);
    render(<Harness />);
    fireEvent.click(opener());
    fireEvent.keyDown(find(), {key: 'Escape'});
    document.removeEventListener('keydown', onWindowKey);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(opener()).toHaveFocus();
    expect(onWindowKey).not.toHaveBeenCalled();
  });

  it('closes on a press outside it, and on Tab', () => {
    render(<Harness />);
    fireEvent.click(opener());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.click(opener());
    fireEvent.keyDown(find(), {key: 'Tab'});
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
