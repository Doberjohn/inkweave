import {describe, it, expect} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {ArtOnScreen, useArtLoad} from '../useArtLoad';

/** Art as a card tile draws it: hidden until loaded, with its fade unless it started loaded. */
function Art({src}: {src: string}) {
  const {loaded, transition, artProps} = useArtLoad(src);
  return (
    <img
      alt={src}
      src={src}
      loading="lazy"
      {...artProps}
      data-loaded={loaded}
      data-fades={transition !== undefined}
    />
  );
}

/** The same art again in a page turn's copy of the page (#942). */
const copy = (src: string) => (
  <ArtOnScreen.Provider value>
    <Art src={src} />
  </ArtOnScreen.Provider>
);

describe('useArtLoad in a copy of art on screen (#942)', () => {
  it('starts a copy loaded, with no fade, once the art has drawn', () => {
    const view = render(<Art src="/drawn.avif" />);
    fireEvent.load(screen.getByAltText('/drawn.avif'));
    view.unmount();

    render(copy('/drawn.avif'));
    const art = screen.getByAltText('/drawn.avif');
    expect(art).toHaveAttribute('data-loaded', 'true');
    expect(art).toHaveAttribute('data-fades', 'false');
    expect(art).toHaveAttribute('loading', 'eager');
  });

  it('keeps a copy of art still on its way hidden over its placeholder until it loads', () => {
    render(copy('/on-its-way.avif'));
    const art = screen.getByAltText('/on-its-way.avif');
    expect(art).toHaveAttribute('data-loaded', 'false');

    fireEvent.load(art);
    expect(art).toHaveAttribute('data-loaded', 'true');
    expect(art).toHaveAttribute('data-fades', 'true');
  });
});
