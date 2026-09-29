import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, it, expect} from 'vitest';
import {RevealAdminForm} from '../RevealAdminForm';
import type {RevealCardForm} from '../../buildPreviewCard';

// Kit Cloudkicker - Sure Shot (14192) as it was typed into reveal-admin (#635).
const SPELLED_OUT =
  'Shift 3 (You may pay 3 Ink to play this on top of one of your characters named Kit Cloudkicker.)';

function kitForm(fullText: string): RevealCardForm {
  return {
    collectorNumber: '192',
    name: 'Kit Cloudkicker',
    version: 'Sure Shot',
    rarity: 'Rare',
    franchise: '',
    cost: '5',
    ink: 'Steel',
    ink2: '',
    inkwell: true,
    type: 'Character',
    strength: '3',
    willpower: '4',
    lore: '2',
    moveCost: '',
    subtypes: '',
    keywords: '',
    fullText,
  };
}

/** The form with real state, beside a Publish button, as RevealAdminPage lays them out. */
function Harness({fullText}: {fullText: string}) {
  const [form, setForm] = useState(() => kitForm(fullText));
  return (
    <>
      <RevealAdminForm
        form={form}
        errors={{}}
        onChange={(patch) => setForm((f) => ({...f, ...patch}))}
      />
      <button type="button">Publish</button>
    </>
  );
}

const cardText = () => screen.getByLabelText('Full card text (one ability per line)');

describe('RevealAdminForm Card Text', () => {
  it('shows the house-style rewrite when the owner moves on to another control', async () => {
    const user = userEvent.setup();
    render(<Harness fullText={SPELLED_OUT} />);
    await user.click(cardText());
    await user.click(screen.getByRole('button', {name: 'Publish'}));
    expect(cardText()).toHaveValue(
      'Shift 3 ⬡ (You may pay 3 ⬡ to play this on top of one of your characters named Kit Cloudkicker.)',
    );
  });

  // Alt-tab to copy the next ability blurs the field but leaves it the active element. A
  // rewrite then would trim the trailing newline and glue the next paste onto this line.
  it('leaves the text exactly as typed when the window loses focus', async () => {
    const user = userEvent.setup();
    const typed = `${SPELLED_OUT}\n`;
    render(<Harness fullText={typed} />);
    await user.click(cardText());
    fireEvent.blur(cardText());
    expect(cardText()).toHaveValue(typed);
  });
});
