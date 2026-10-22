import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {createCard} from '../../../../shared/test-utils';
import {ModalCardTitle} from '../ModalCardTitle';

describe('ModalCardTitle', () => {
  it('names the heading after the card alone, with the set logo beside it', () => {
    render(<ModalCardTitle card={createCard({fullName: 'Thomas - Wide-Eyed Recruit', setCode: '11'})} isMobile={false} />);
    // The E2E specs and the dialog read the heading: the logo must not join its name.
    expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Thomas - Wide-Eyed Recruit');
    expect(screen.getByRole('img', {name: 'Winterspell'})).toHaveAttribute('title', 'Winterspell');
  });

  it('shows the name alone for a set without a logo', () => {
    render(<ModalCardTitle card={createCard({setCode: '99'})} isMobile={false} />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it("shows a promo card's code without a logo", () => {
    render(<ModalCardTitle card={createCard({rarity: 'Special', setCode: 'P1', setNumber: 25})} isMobile={false} />);
    expect(screen.getByText('25/P1')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('shows the name alone on phones, where the logo would wrap the title', () => {
    render(<ModalCardTitle card={createCard({setCode: '11', setNumber: 52})} isMobile />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('52/204')).toBeNull();
  });

  it('reads the number printed on the printing on show before the logo, outside the heading', () => {
    const card = createCard({fullName: 'Thomas - Wide-Eyed Recruit', setCode: '11', setNumber: 52});
    const {rerender} = render(<ModalCardTitle card={card} isMobile={false} />);

    const number = screen.getByText('52/204');
    expect(number.textContent).toBe('Card number 52/204');
    expect(number.nextElementSibling).toBe(screen.getByRole('img', {name: 'Winterspell'}));
    expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Thomas - Wide-Eyed Recruit');

    rerender(<ModalCardTitle card={card} isMobile={false} printing={{key: 'e', label: 'Enchanted', rarity: 'Enchanted', number: 223}} />);
    expect(screen.getByText('223/204')).toBeInTheDocument();
  });
});
