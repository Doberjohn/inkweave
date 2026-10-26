import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {cardPath} from 'inkweave-synergy-engine/card';
import {createCard} from '../../../shared/test-utils/factories';
import {PlaystyleGuide} from '../PlaystyleGuide';
import type {PlaystyleGuide as Guide} from '../playstyleGuides';

const ELSA = createCard({id: '1', fullName: 'Elsa - Snow Queen', ink: 'Amethyst'});
const PETRIFY = createCard({id: '2', fullName: 'Petrify', ink: 'Amethyst'});
const ROBIN = createCard({id: '3', fullName: 'Christopher Robin - Hunny Sage', ink: 'Amethyst', ink2: 'Sapphire'});
const OTHER = createCard({id: '4', fullName: 'Other Card - Not Key'});
const CARDS = [ELSA, PETRIFY, ROBIN, OTHER];

// Listed out of the cards' order, so the guide's own order shows.
const GUIDE: Guide = {paragraphs: ['How it wins.', 'How to build it.'], keyCards: ['2', '1', '3']};

function renderGuide(cards = CARDS) {
  const onOpenCard = vi.fn();
  render(<PlaystyleGuide name="Exert" guide={GUIDE} cards={cards} onOpenCard={onOpenCard} padding="0" />);
  return {onOpenCard, links: () => screen.queryAllByRole('link')};
}

describe('PlaystyleGuide', () => {
  it('names the playstyle in the heading that labels the section', () => {
    renderGuide();
    const section = screen.getByRole('region', {name: 'How to play Exert'});
    expect(within(section).getByRole('heading', {level: 2})).toHaveTextContent('How to play Exert');
  });

  it('shows both paragraphs', () => {
    renderGuide();
    expect(screen.getByText('How it wins.')).toBeInTheDocument();
    expect(screen.getByText('How to build it.')).toBeInTheDocument();
  });

  it("links each key card to its card page by its current name, in the guide's order", () => {
    const {links} = renderGuide();
    expect(links().map((link) => link.textContent)).toEqual([PETRIFY, ELSA, ROBIN].map((card) => card.fullName));
    expect(links().map((link) => link.getAttribute('href'))).toEqual([PETRIFY, ELSA, ROBIN].map(cardPath));
  });

  it('opens the card window on a plain click, with the key cards as its list', () => {
    const {onOpenCard, links} = renderGuide();
    const notPrevented = fireEvent.click(links()[1]);
    expect(notPrevented).toBe(false);
    expect(onOpenCard).toHaveBeenCalledExactlyOnceWith('1', ['2', '1', '3']);
  });

  it('leaves a modified click to the browser, which opens the card page', () => {
    const {onOpenCard, links} = renderGuide();
    let preventedByGuide: boolean | undefined;
    // Runs after the guide's handler. jsdom can't open another page, so it stops the click there.
    const afterGuide = (event: Event) => {
      preventedByGuide = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener('click', afterGuide);
    fireEvent.click(links()[0], {ctrlKey: true});
    window.removeEventListener('click', afterGuide);
    expect(preventedByGuide).toBe(false);
    expect(onOpenCard).not.toHaveBeenCalled();
  });

  it("leaves out a key card that isn't among the playstyle's cards, from the links and the window's list", () => {
    const {onOpenCard, links} = renderGuide([ELSA, ROBIN, OTHER]);
    expect(links().map((link) => link.textContent)).toEqual([ELSA.fullName, ROBIN.fullName]);
    fireEvent.click(links()[0]);
    expect(onOpenCard).toHaveBeenCalledExactlyOnceWith('1', ['1', '3']);
  });

  it('drops the key cards heading when none of them is left', () => {
    const {links} = renderGuide([OTHER]);
    expect(screen.queryByRole('heading', {name: 'Key cards'})).not.toBeInTheDocument();
    expect(links()).toEqual([]);
    expect(screen.getByText('How it wins.')).toBeInTheDocument();
  });

  it('renders nothing without a guide, as while the guides load or when they failed', () => {
    const {container} = render(
      <PlaystyleGuide name="Exert" guide={undefined} cards={CARDS} onOpenCard={vi.fn()} padding="0" />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
