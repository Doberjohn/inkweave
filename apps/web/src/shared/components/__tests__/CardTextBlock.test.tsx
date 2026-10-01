import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CardTextBlock} from '../CardTextBlock';
import {createCard} from '../../test-utils';

/** Renders one text section and returns the bolded ability name, or null when nothing is bold. */
function boldNameOf(section: string): string | null {
  render(<CardTextBlock card={createCard({textSections: [section]})} />);
  const bold = screen.getByTestId('card-text-block').querySelector('span[style*="font-weight"]');
  return bold?.textContent ?? null;
}

describe('CardTextBlock', () => {
  it('should render nothing when card has no text', () => {
    const card = createCard({text: undefined, textSections: undefined});
    const {container} = render(<CardTextBlock card={card} />);
    expect(container.innerHTML).toBe('');
  });

  it('should fall back to card.text when textSections is empty', () => {
    const card = createCard({text: 'Some ability text', textSections: undefined});
    render(<CardTextBlock card={card} />);
    expect(screen.getByText('Some ability text')).toBeInTheDocument();
  });

  it('should render each section as a separate paragraph', () => {
    const card = createCard({
      textSections: ['First ability', 'Second ability'],
      text: 'First ability\nSecond ability',
    });
    render(<CardTextBlock card={card} />);
    expect(screen.getByText('First ability')).toBeInTheDocument();
    expect(screen.getByText('Second ability')).toBeInTheDocument();

    const block = screen.getByTestId('card-text-block');
    const paragraphs = block.querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
  });

  it('should bold only the ability name when the effect follows it directly', () => {
    expect(
      boldNameOf('COMMUNITY SERVICE At the end of your turn, you may ready this character.'),
    ).toBe('COMMUNITY SERVICE');
  });

  // No current card opens an effect on "A"; this guards the name boundary for future sets.
  it.each([
    ['SNACK TIME A Princess character gets +1 ◊.', 'SNACK TIME'],
    ['SNACK TIME A character with Evasive gains Rush.', 'SNACK TIME'],
  ])('should end the name before an effect opening on a one-letter word: %s', (section, name) => {
    expect(boldNameOf(section)).toBe(name);
  });

  it.each([
    ['FREEZE ⟳ — Exert chosen opposing character.', 'FREEZE'],
    ['CIVIC DUTY 6 ⬡ — Remove all damage from chosen character or location.', 'CIVIC DUTY'],
    ['A WONDERFUL DREAM — Remove up to 3 damage from chosen character.', 'A WONDERFUL DREAM'],
  ])('should bold an activated ability name but not its cost: %s', (section, name) => {
    expect(boldNameOf(section)).toBe(name);
  });

  it('should keep the section text intact across the bold split', () => {
    const section = 'CIVIC DUTY 6 ⬡ — Remove all damage. (Reminder text.)';
    render(<CardTextBlock card={createCard({textSections: [section]})} />);
    expect(screen.getByTestId('card-text-block').querySelector('p')!.textContent).toBe(section);
  });

  it.each([
    ['TAKE… YOUR… TIME Characters lose Rush and can’t gain Rush.', 'TAKE… YOUR… TIME'],
    ['I’VE GOT THIS While you have another Detective character in play, ...', 'I’VE GOT THIS'],
    ['KEEP ‘EM COMING 6 ⬡ — Whenever one of your characters challenges, ...', 'KEEP ‘EM COMING'],
    ['...AND BEYOND! Whenever this character quests, ...', '...AND BEYOND!'],
    ['OK, WHERE AM I? When you play this character, ...', 'OK, WHERE AM I?'],
  ])('should keep punctuation inside the ability name: %s', (section, name) => {
    expect(boldNameOf(section)).toBe(name);
  });

  it.each([
    'Shift 5 (You may pay 5 ⬡ to play this on top of one of your characters named Stitch.)',
    'Support (Whenever this character quests, you may add their ¤ to another character’s ¤.)',
    'A Princess character gets +1 ◊.',
    'I Choose you.',
  ])('should not bold keyword lines or text opening on a single capital: %s', (section) => {
    expect(boldNameOf(section)).toBeNull();
  });

  it('should render parenthesized reminder text in italic', () => {
    const card = createCard({
      textSections: ['Singer 5 (This character counts as cost 5 to sing songs.)'],
    });
    render(<CardTextBlock card={card} />);

    const italic = screen
      .getByTestId('card-text-block')
      .querySelector('span[style*="font-style: italic"]');
    expect(italic).toBeTruthy();
    expect(italic!.textContent).toContain('This character counts as cost 5');
  });

  it('should bold ability name and italicize reminder in the same section', () => {
    const card = createCard({
      textSections: ["DEEP FREEZE ⟳ — Exert chosen character. (They can't ready next turn.)"],
      text: "DEEP FREEZE ⟳ — Exert chosen character. (They can't ready next turn.)",
    });
    render(<CardTextBlock card={card} />);

    const block = screen.getByTestId('card-text-block');
    const bold = block.querySelector('span[style*="font-weight"]');
    const italic = block.querySelector('span[style*="font-style: italic"]');
    expect(bold).toBeTruthy();
    expect(bold!.textContent).toBe('DEEP FREEZE');
    expect(italic).toBeTruthy();
    expect(italic!.textContent).toContain("They can't ready next turn.");
  });

  it('should prefer textSections over text when both are present', () => {
    const card = createCard({
      text: 'Singer 5 (reminder)\nA WONDERFUL DREAM — effect',
      textSections: ['Singer 5 (reminder)', 'A WONDERFUL DREAM — effect'],
    });
    render(<CardTextBlock card={card} />);
    const paragraphs = screen.getByTestId('card-text-block').querySelectorAll('p');
    expect(paragraphs).toHaveLength(2);
  });

  it('should add a divider between sections but not after the last', () => {
    const card = createCard({
      textSections: ['Ability one', 'Ability two', 'Ability three'],
    });
    render(<CardTextBlock card={card} />);

    const paragraphs = screen.getByTestId('card-text-block').querySelectorAll('p');
    expect(paragraphs).toHaveLength(3);
    // First two should have bottom border, last should not
    expect(paragraphs[0].style.borderBottom).toContain('1px solid');
    expect(paragraphs[2].style.borderBottom).toBe('');
  });

  // Paragraphs are keyed by position, so paging to a card with fewer sections makes a middle
  // paragraph the last one. Its bottom spacing must go to zero, not be unset: the browser's
  // default 1em paragraph margin would come back.
  it('should keep the new last paragraph flush when the card changes to fewer sections', () => {
    const {rerender} = render(
      <CardTextBlock card={createCard({textSections: ['Ability one', 'Ability two']})} />,
    );

    rerender(<CardTextBlock card={createCard({textSections: ['Ability one']})} />);

    const last = screen.getByTestId('card-text-block').querySelector('p')!;
    expect(last.style.marginBottom).toBe('0px');
    expect(last.style.paddingBottom).toBe('0px');
  });
});
