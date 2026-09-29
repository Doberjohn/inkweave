import {useState} from 'react';
import {describe, it, expect, vi, beforeEach, afterEach, type MockInstance} from 'vitest';
import {render, screen, fireEvent, act, waitFor} from '@testing-library/react';
import {createCard} from '../../test-utils';
import type {Printing} from '../../hooks';
import {PrintingCarousel} from '../PrintingCarousel';

const card = createCard({id: '1938', fullName: 'Pongo - Determined Father'});
const PRINTINGS: Printing[] = [
  {key: 'standard', label: 'Standard', imageUrl: '/card-images/1938.avif'},
  {key: '2141', label: 'Enchanted', rarity: 'Enchanted', imageUrl: '/card-images/2141.avif'},
];

let stripScrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stripScrollTo = vi.fn();
  Element.prototype.scrollTo = stripScrollTo as unknown as Element['scrollTo'];
});

function renderCarousel(props: Partial<Parameters<typeof PrintingCarousel>[0]> = {}) {
  const onIndexChange = vi.fn();
  const onEnlarge = vi.fn();
  const utils = render(
    <PrintingCarousel
      card={card}
      printings={PRINTINGS}
      index={0}
      onIndexChange={onIndexChange}
      onEnlarge={onEnlarge}
      width={298}
      height={417}
      {...props}
    />,
  );
  return {...utils, onIndexChange, onEnlarge};
}

describe('PrintingCarousel', () => {
  it('shows one slide per printing, each image named for its printing', () => {
    renderCarousel();

    expect(screen.getByRole('img', {name: 'Pongo - Determined Father'})).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Pongo - Determined Father, Enchanted printing',
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  it('enlarges the printing whose slide is clicked', () => {
    const {onEnlarge} = renderCarousel({index: 1});

    fireEvent.click(screen.getByRole('button', {name: 'Enlarge Enchanted printing'}));

    expect(onEnlarge).toHaveBeenCalledWith(1);
  });

  it('keeps the slides not shown out of reach of the keyboard and screen readers', () => {
    renderCarousel({index: 0});

    expect(
      screen.queryByRole('button', {name: 'Enlarge Enchanted printing'}),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Enlarge Standard printing'})).toBeInTheDocument();
  });

  it('scrolls to the printing selected elsewhere (the pills)', () => {
    const {rerender} = renderCarousel({index: 0});
    stripScrollTo.mockClear();

    rerender(
      <PrintingCarousel
        card={card}
        printings={PRINTINGS}
        index={1}
        onIndexChange={() => {}}
        width={298}
        height={417}
      />,
    );

    expect(stripScrollTo).toHaveBeenCalledTimes(1);
  });

  it('reports a swipe to the next printing', () => {
    const {onIndexChange} = renderCarousel();
    const viewport = screen.getByRole('group', {name: 'Pongo - Determined Father printings'});
    Object.defineProperty(viewport, 'clientWidth', {value: 298, configurable: true});
    viewport.scrollLeft = 298;

    act(() => {
      fireEvent.scroll(viewport);
    });

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  // The modal's expanded group view unmounts the strip; coming back must not show the
  // Standard art first and slide across to the printing still picked.
  it('mounts on the printing it is given, without animating from the first', () => {
    renderCarousel({index: 1});

    expect(stripScrollTo).not.toHaveBeenCalled();
  });

  // A swipe (or arrow keys scrolling the strip) inerts the slide it leaves; focus on that
  // slide's Enlarge button would otherwise fall to <body>.
  it('hands keyboard focus to the slide a swipe brings in', () => {
    function Swipeable() {
      const [index, setIndex] = useState(0);
      return (
        <PrintingCarousel
          card={card}
          printings={PRINTINGS}
          index={index}
          onIndexChange={setIndex}
          onEnlarge={() => {}}
          width={298}
          height={417}
        />
      );
    }
    render(<Swipeable />);
    screen.getByRole('button', {name: 'Enlarge Standard printing'}).focus();
    const viewport = screen.getByRole('group', {name: 'Pongo - Determined Father printings'});
    Object.defineProperty(viewport, 'clientWidth', {value: 298, configurable: true});
    viewport.scrollLeft = 298;

    act(() => {
      fireEvent.scroll(viewport);
    });

    expect(screen.getByRole('button', {name: 'Enlarge Enchanted printing'})).toHaveFocus();
  });
});

// Lazy loading can't hold the next slide back (it sits inside the browsers' lazy-load
// distance), so the variant's art would otherwise compete with the Standard art: the card
// page's LCP image.
describe('PrintingCarousel variant art', () => {
  let complete: MockInstance;
  beforeEach(() => {
    complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
  });
  afterEach(() => {
    complete.mockRestore();
  });
  const variantArt = () =>
    screen.getByRole('img', {name: 'Pongo - Determined Father, Enchanted printing', hidden: true});

  it('holds the variant art back until the Standard art has loaded', async () => {
    renderCarousel();
    expect(variantArt()).not.toHaveAttribute('src');

    fireEvent.load(screen.getByRole('img', {name: 'Pongo - Determined Father'}));

    await waitFor(() => expect(variantArt()).toHaveAttribute('src', '/card-images/2141.avif'));
  });

  it('loads the variant art at once when a swipe starts', () => {
    renderCarousel();

    fireEvent.touchStart(screen.getByRole('group', {name: 'Pongo - Determined Father printings'}));

    expect(variantArt()).toHaveAttribute('src', '/card-images/2141.avif');
  });

  it('loads the variant art at once when the variant is picked', () => {
    const {rerender} = renderCarousel();

    rerender(
      <PrintingCarousel
        card={card}
        printings={PRINTINGS}
        index={1}
        onIndexChange={() => {}}
        width={298}
        height={417}
      />,
    );

    expect(variantArt()).toHaveAttribute('src', '/card-images/2141.avif');
  });
});
