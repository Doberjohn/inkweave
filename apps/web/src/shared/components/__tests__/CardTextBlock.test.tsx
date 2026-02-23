import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CardTextBlock} from '../CardTextBlock';
import {createCard} from '../../test-utils';

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

  it('should render ability names in bold', () => {
    const card = createCard({
      textSections: ['FREEZE ↷ — Exert chosen opposing character.'],
    });
    render(<CardTextBlock card={card} />);

    const bold = screen.getByTestId('card-text-block').querySelector('span[style*="font-weight"]');
    expect(bold).toBeTruthy();
    expect(bold!.textContent).toContain('FREEZE');
  });

  it('should render parenthesized reminder text in italic', () => {
    const card = createCard({
      textSections: ['Singer 5 (This character counts as cost 5 to sing songs.)'],
    });
    render(<CardTextBlock card={card} />);

    const italic = screen.getByTestId('card-text-block').querySelector('span[style*="font-style: italic"]');
    expect(italic).toBeTruthy();
    expect(italic!.textContent).toContain('This character counts as cost 5');
  });

  it('should bold ability name and italicize reminder in the same section', () => {
    const card = createCard({
      textSections: ['DEEP FREEZE ↷ — Exert chosen character. (They can\'t ready next turn.)'],
      text: 'DEEP FREEZE ↷ — Exert chosen character. (They can\'t ready next turn.)',
    });
    render(<CardTextBlock card={card} />);

    const block = screen.getByTestId('card-text-block');
    const bold = block.querySelector('span[style*="font-weight"]');
    const italic = block.querySelector('span[style*="font-style: italic"]');
    expect(bold).toBeTruthy();
    expect(bold!.textContent).toContain('DEEP FREEZE');
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
});
