import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import {PrintingName, type NamedPrinting} from '../PrintingName';

/** A printing's name, in the row the peek and the turn's notice put it in. */
function renderName(printing: NamedPrinting) {
  const {container} = render(
    <div>
      <PrintingName printing={printing} />
    </div>,
  );
  return container.firstElementChild as HTMLElement;
}

describe('PrintingName', () => {
  it("marks a chase printing with its rarity's symbol beside its name, and leaves Standard plain (#802)", () => {
    for (const rarity of ['Enchanted', 'Epic', 'Iconic']) {
      const name = renderName({key: rarity, label: rarity, rarity});
      expect(name).toHaveTextContent(rarity);
      expect(name.querySelector('img')).toHaveAttribute('src', expect.stringContaining(rarity.toLowerCase()));
    }

    expect(renderName({key: 'standard', label: 'Standard'}).querySelector('img')).toBeNull();
  });

  it('marks an alt foil with the foil marker, not a symbol (#802)', () => {
    const name = renderName({key: '3571', label: 'Alt foil', rarity: 'Legendary', number: 243});

    expect(name).toHaveTextContent('Alt foil');
    expect(name.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(name.querySelector('img')).toBeNull();
  });

  it("shows a promo's symbol and the code printed on it (#802)", () => {
    const name = renderName({key: '2183', label: '5/P3', rarity: 'Special', number: 5, promoGrouping: 'P3'});

    expect(name).toHaveTextContent('5/P3');
    expect(name.querySelector('img')).toHaveAttribute('src', expect.stringContaining('promo'));
  });

  // The row's gap only spaces the words on screen: copying or finding the text needs a real space.
  it("spaces a promo twin's finish from its code in its text (#802)", () => {
    const twin = {key: '80010', label: '8/C1 foil', rarity: 'Special', number: 8, promoGrouping: 'C1'};

    expect(renderName({...twin, finish: 'foil'}).textContent).toBe('8/C1 foil');
  });

  it("names a promo by its art's letter and by the name printed on it, so siblings stay apart (#891)", () => {
    const p2 = {rarity: 'Special', promoGrouping: 'P2'};

    expect(renderName({...p2, key: '1661', label: '24A/P2', number: 24, artVariant: 'A'}).textContent).toBe('24A/P2');
    expect(
      renderName({...p2, key: '1663', label: '26/P2 Vaiana', number: 26, printedName: 'Vaiana'}).textContent,
    ).toBe('26/P2 Vaiana');
  });
});
