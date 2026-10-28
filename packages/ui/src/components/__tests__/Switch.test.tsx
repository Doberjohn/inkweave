import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Switch} from '../Switch';

/** The switch named by a label, as SharingSwitch names it. */
function Labelled(props: {checked: boolean; disabled?: boolean; onCheckedChange: (checked: boolean) => void}) {
  return (
    <>
      <Switch id="share" aria-labelledby="share-title" {...props} />
      <label id="share-title" htmlFor="share">
        Let my friends see my collection
      </label>
    </>
  );
}

describe('Switch', () => {
  it('is a switch named by its label, saying whether it is on', () => {
    render(<Labelled checked onCheckedChange={vi.fn()} />);
    expect(screen.getByRole('switch', {name: 'Let my friends see my collection'})).toHaveAttribute('aria-checked', 'true');
  });

  it('asks for the other state when pressed, by its label or by the keyboard', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Labelled checked={false} onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByText('Let my friends see my collection'));
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);

    screen.getByRole('switch').focus();
    await user.keyboard(' ');
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
  });

  it('holds still while disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Labelled checked={false} disabled onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole('switch'));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
