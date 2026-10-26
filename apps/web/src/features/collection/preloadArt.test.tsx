import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {ArtOnScreen, useArtLoad} from '../../shared/hooks/useArtLoad';
import {preloadArt} from './preloadArt';

/** Art hidden until loaded, with its fade unless it started loaded. */
function Art({src}: {src: string}) {
  const {loaded, transition, artProps} = useArtLoad(src);
  return <img alt={src} src={src} loading="lazy" {...artProps} data-loaded={loaded} data-fades={transition !== undefined} />;
}

/** The art as a binder pocket draws it (#942), under `ArtOnScreen`. */
const pocket = (src: string) => (
  <ArtOnScreen.Provider value>
    <Art src={src} />
  </ArtOnScreen.Provider>
);

/** jsdom never loads an image: each one loading ahead waits here for the test to settle its decode. */
let decodes: Map<string, {resolve: () => void; reject: () => void}>;
class TestImage {
  src = '';
  decode() {
    return new Promise<void>((resolve, reject) => decodes.set(this.src, {resolve, reject}));
  }
}

/** Lets the decode's handlers run. */
const settled = () => new Promise((resolve) => setTimeout(resolve));

describe('preloadArt: the binder loading the pages either side ahead (owner, 2026-10-26)', () => {
  beforeEach(() => {
    decodes = new Map();
    vi.stubGlobal('Image', TestImage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts art loaded ahead loaded, with no fade, where it draws again', async () => {
    preloadArt('/ahead.avif');
    decodes.get('/ahead.avif')!.resolve();
    await settled();

    render(pocket('/ahead.avif'));
    const art = screen.getByAltText('/ahead.avif');
    expect(art).toHaveAttribute('data-loaded', 'true');
    expect(art).toHaveAttribute('data-fades', 'false');
  });

  it('keeps art still decoding ahead over its placeholder', () => {
    preloadArt('/decoding.avif');
    render(pocket('/decoding.avif'));
    expect(screen.getByAltText('/decoding.avif')).toHaveAttribute('data-loaded', 'false');
  });

  it('leaves art that failed to load ahead to its own <img>, and asks for it again next time', async () => {
    preloadArt('/broken.avif');
    decodes.get('/broken.avif')!.reject();
    await settled();

    render(pocket('/broken.avif'));
    expect(screen.getByAltText('/broken.avif')).toHaveAttribute('data-loaded', 'false');
    decodes.clear();
    preloadArt('/broken.avif');
    expect(decodes.has('/broken.avif')).toBe(true);
  });

  it('loads each art once', () => {
    preloadArt('/once.avif');
    decodes.clear();
    preloadArt('/once.avif');
    expect(decodes.size).toBe(0);
  });
});
