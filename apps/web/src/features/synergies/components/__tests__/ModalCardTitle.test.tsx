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

  it('shows the name alone on phones, where the logo would wrap the title', () => {
    render(<ModalCardTitle card={createCard({setCode: '11', setNumber: 52})} isMobile />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByText('52/204')).toBeNull();
  });

  it('reads the number printed on the printing on show after the logo, outside the heading', () => {
    const card = createCard({fullName: 'Thomas - Wide-Eyed Recruit', setCode: '11', setNumber: 52});
    const {rerender} = render(<ModalCardTitle card={card} isMobile={false} />);

    const number = screen.getByText('52/204');
    expect(number.textContent).toBe('Card number 52/204');
    expect(screen.getByRole('img', {name: 'Winterspell'}).nextElementSibling).toBe(number);
    expect(screen.getByRole('heading', {level: 1}).textContent).toBe('Thomas - Wide-Eyed Recruit');

    rerender(<ModalCardTitle card={card} isMobile={false} printing={{key: 'e', label: 'Enchanted', rarity: 'Enchanted', number: 223}} />);
    expect(screen.getByText('223/204')).toBeInTheDocument();
  });

  it('names the heading by the name printed on the printing on show: 26/P2 reads Vaiana (#891)', () => {
    const moana = createCard({
      name: 'Moana',
      version: 'Adventurer of Land and Sea',
      fullName: 'Moana - Adventurer of Land and Sea',
      setCode: '7',
    });
    const vaiana = {
      key: '1663',
      label: '26/P2',
      rarity: 'Special',
      number: 26,
      promoGrouping: 'P2',
      printedName: 'Vaiana',
    };
    render(<ModalCardTitle card={moana} isMobile={false} printing={vaiana} />);

    const heading = screen.getByRole('heading', {level: 1});
    expect(heading.textContent).toBe('Vaiana - Adventurer of Land and Sea');
  });
});
