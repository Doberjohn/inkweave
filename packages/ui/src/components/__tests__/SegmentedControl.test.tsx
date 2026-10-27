import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SegmentedControl} from '../SegmentedControl';

type SortKey = 'gap' | 'votes';
const OPTIONS: ReadonlyArray<{value: SortKey; label: string}> = [
  {value: 'gap', label: '|Gap|'},
  {value: 'votes', label: 'Votes'},
];

/** Holds the value the way a page does, so aria-pressed follows each change. */
function Harness({onChange}: {onChange: (v: SortKey) => void}) {
  const [value, setValue] = useState<SortKey>('gap');
  return (
    <SegmentedControl
      ariaLabel="Sort rules"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('SegmentedControl', () => {
  it('is a named group of toggle buttons with the selected one pressed', () => {
    render(<Harness onChange={() => {}} />);
    expect(screen.getByRole('group', {name: 'Sort rules'})).toBeInTheDocument();
    const gap = screen.getByRole('button', {name: '|Gap|'});
    expect(gap).toHaveAttribute('aria-pressed', 'true');
    expect(gap).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', {name: 'Votes'})).toHaveAttribute('aria-pressed', 'false');
  });

  it('presses nothing when the value is null', () => {
    render(
      <SegmentedControl
        options={[
          {value: 'a', label: 'A'},
          {value: 'b', label: 'B'},
        ]}
        value={null}
        onChange={() => {}}
        ariaLabel="Pick"
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
    ]);
  });

  it.each(OPTIONS)('reports a press on $label while nothing is chosen', async ({value, label}) => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Sort rules"
        options={OPTIONS}
        value={null}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', {name: label}));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(value);
  });

  it('reports a click on another option', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', {name: 'Votes'}));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('votes');
    expect(screen.getByRole('button', {name: 'Votes'})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: '|Gap|'})).toHaveAttribute('aria-pressed', 'false');
  });

  it('works from the keyboard: Tab between options, Enter or Space to pick', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Votes'})).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('votes');

    await userEvent.tab({shift: true});
    expect(screen.getByRole('button', {name: '|Gap|'})).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenLastCalledWith('gap');
    expect(screen.getByRole('button', {name: '|Gap|'})).toHaveAttribute('aria-pressed', 'true');
  });

  it('ignores a press on the option that is already selected', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', {name: '|Gap|'}));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('holds every option while held: aria-disabled, so each keeps its focus, and a press does nothing', async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Sort rules"
        options={OPTIONS}
        value="gap"
        onChange={onChange}
        held
      />,
    );
    for (const button of screen.getAllByRole('button'))
      expect(button).toHaveAttribute('aria-disabled', 'true');

    const votes = screen.getByRole('button', {name: 'Votes'});
    await userEvent.click(votes);
    expect(onChange).not.toHaveBeenCalled();
    // Not a native disabled, which would drop the focus to the page.
    expect(votes).toBeEnabled();
    expect(votes).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onChange).not.toHaveBeenCalled();
    expect(votes).toHaveAttribute('aria-pressed', 'false');
  });

  it('is live again once it is no longer held, and is never held by default', async () => {
    const onChange = vi.fn();
    const {rerender} = render(
      <SegmentedControl
        ariaLabel="Sort rules"
        options={OPTIONS}
        value="gap"
        onChange={onChange}
        held
      />,
    );
    rerender(
      <SegmentedControl ariaLabel="Sort rules" options={OPTIONS} value="gap" onChange={onChange} />,
    );
    for (const button of screen.getAllByRole('button'))
      expect(button).not.toHaveAttribute('aria-disabled');
    await userEvent.click(screen.getByRole('button', {name: 'Votes'}));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('votes');
  });

  it('marks a control that fills its width for its stylesheet (data-fill), and leaves the default as wide as its options', () => {
    render(
      <>
        <SegmentedControl ariaLabel="Type" options={OPTIONS} value="gap" onChange={() => {}} fill />
        <SegmentedControl
          ariaLabel="Sort rules"
          options={OPTIONS}
          value="gap"
          onChange={() => {}}
        />
      </>,
    );
    expect(screen.getByRole('group', {name: 'Type'})).toHaveAttribute('data-fill', 'true');
    expect(screen.getByRole('group', {name: 'Sort rules'})).not.toHaveAttribute('data-fill');
  });

  it('sets a filling control’s buttons two to a pair, in order, a lone last one marked, and a plain one’s straight in the group', () => {
    const types = ['Character', 'Action', 'Item', 'Location', 'Song'].map((label) => ({
      value: label,
      label,
    }));
    render(
      <>
        <SegmentedControl
          ariaLabel="Type"
          options={types}
          value="Character"
          onChange={() => {}}
          fill
        />
        <SegmentedControl
          ariaLabel="Sort rules"
          options={OPTIONS}
          value="gap"
          onChange={() => {}}
        />
      </>,
    );
    const children = (name: string) =>
      Array.from(screen.getByRole('group', {name}).children, (child) => ({
        className: child.className,
        labels:
          child.tagName === 'BUTTON'
            ? child.textContent
            : Array.from(child.children, (button) => button.textContent),
        lone: child.getAttribute('data-lone'),
      }));
    // A wrap goes two and two. The odd count's last button sits alone, and its pair says so
    // (data-lone), so on a line it shares the stylesheet gives it one button's width, not a pair's.
    expect(children('Type')).toEqual([
      {className: 'segmented-pair', labels: ['Character', 'Action'], lone: null},
      {className: 'segmented-pair', labels: ['Item', 'Location'], lone: null},
      {className: 'segmented-pair', labels: ['Song'], lone: 'true'},
    ]);
    expect(children('Sort rules')).toEqual([
      {className: 'segmented-btn', labels: '|Gap|', lone: null},
      {className: 'segmented-btn', labels: 'Votes', lone: null},
    ]);
    // The pairs are layout alone: every option is still a button of the named group.
    expect(
      screen.getAllByRole('button', {name: /^(Character|Action|Item|Location|Song)$/}),
    ).toHaveLength(5);
  });
});
