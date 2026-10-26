import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {ArtOnScreen, useArtLoad} from '../../shared/hooks/useArtLoad';
import {preloadArt} from './preloadArt';

/** Art hidden until loaded, with its fade unless it started loaded, and its placeholder kept under it while `underlay`. */
function Art({src}: {src: string}) {
  const {loaded, underlay, transition, artProps} = useArtLoad(src);
  return (
    <img
      alt={src}
      src={src}
      loading="lazy"
      {...artProps}
      data-loaded={loaded}
      data-underlay={underlay}
      data-fades={transition !== undefined}
    />
  );
}

/** The art as a binder pocket draws it (#942), under `ArtOnScreen`. */
const pocket = (src: string) => (
  <ArtOnScreen.Provider value>
    <Art src={src} />
  </ArtOnScreen.Provider>
);

/** jsdom never loads an image: each one loading ahead waits here for the test to settle its decode. */
let decodes: Map<string, {resolve: () => void; reject: () => void}>;
/** Every decode a test left waiting, failed after it so the next test starts with no load running. */
let unsettled: (() => void)[];
/** The priority each art loading ahead was asked for at. */
let priorities: Map<string, string>;
class TestImage {
  fetchPriority = 'auto';
  private url = '';
  set src(src: string) {
    priorities.set(src, this.fetchPriority);
    this.url = src;
  }
  get src() {
    return this.url;
  }
  decode() {
    return new Promise<void>((resolve, reject) => {
      decodes.set(this.src, {resolve, reject});
      unsettled.push(reject);
    });
  }
}

/** Lets the decode's handlers run. */
const settled = () => new Promise((resolve) => setTimeout(resolve));

describe('preloadArt: the binder loading the pages either side ahead (owner, 2026-10-26)', () => {
  beforeEach(() => {
    decodes = new Map();
    unsettled = [];
    priorities = new Map();
    vi.stubGlobal('Image', TestImage);
  });
  afterEach(async () => {
    unsettled.forEach((reject) => reject());
    await settled();
    vi.unstubAllGlobals();
  });

  it('starts art loaded ahead loaded, with no fade, where it draws again', async () => {
    preloadArt(['/ahead.avif']);
    decodes.get('/ahead.avif')!.resolve();
    await settled();

    render(pocket('/ahead.avif'));
    const art = screen.getByAltText('/ahead.avif');
    expect(art).toHaveAttribute('data-loaded', 'true');
    expect(art).toHaveAttribute('data-fades', 'false');
  });

  it('keeps its placeholder under it until its <img> has it, should the browser have let it go (Claude review, PR #1002)', async () => {
    preloadArt(['/held.avif']);
    decodes.get('/held.avif')!.resolve();
    await settled();

    render(pocket('/held.avif'));
    const art = screen.getByAltText('/held.avif');
    expect(art).toHaveAttribute('data-underlay', 'true');
    fireEvent.load(art);
    expect(art).toHaveAttribute('data-underlay', 'false');
    expect(art).toHaveAttribute('data-fades', 'false');
  });

  it('asks for art ahead at low priority, behind the art in view (Claude review, PR #1002)', () => {
    preloadArt(['/low.avif']);
    expect(priorities.get('/low.avif')).toBe('low');
  });

  it('loads two at a time, the next as one comes, so the page keeps connections of its own (CI, PR #1002)', async () => {
    preloadArt(['/q1.avif', '/q2.avif', '/q3.avif']);
    expect([...decodes.keys()]).toEqual(['/q1.avif', '/q2.avif']);
    decodes.get('/q1.avif')!.resolve();
    await settled();
    expect([...decodes.keys()]).toEqual(['/q1.avif', '/q2.avif', '/q3.avif']);
  });

  it('drops the art still waiting when the view moves on, for the new view’s', async () => {
    preloadArt(['/r1.avif', '/r2.avif', '/r3.avif']);
    preloadArt(['/r4.avif']);
    decodes.get('/r1.avif')!.resolve();
    await settled();
    expect([...decodes.keys()]).toEqual(['/r1.avif', '/r2.avif', '/r4.avif']);
  });

  it('keeps art still decoding ahead over its placeholder', () => {
    preloadArt(['/decoding.avif']);
    render(pocket('/decoding.avif'));
    expect(screen.getByAltText('/decoding.avif')).toHaveAttribute('data-loaded', 'false');
  });

  it('leaves art that failed to load ahead to its own <img>, and asks for it again next time', async () => {
    preloadArt(['/broken.avif']);
    decodes.get('/broken.avif')!.reject();
    await settled();

    render(pocket('/broken.avif'));
    expect(screen.getByAltText('/broken.avif')).toHaveAttribute('data-loaded', 'false');
    decodes.clear();
    preloadArt(['/broken.avif']);
    expect(decodes.has('/broken.avif')).toBe(true);
  });

  it('loads each art once', () => {
    preloadArt(['/once.avif']);
    decodes.clear();
    preloadArt(['/once.avif']);
    expect(decodes.size).toBe(0);
  });
});
