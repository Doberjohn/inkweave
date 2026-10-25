import {createContext, useContext, useState} from 'react';
import {EASING} from '../constants';
import {prerenderedArtShown} from '../lib/prerenderedArt';

/** Card art's load: on its way, loaded, or in the browser already when its `<img>` mounted. */
type ArtLoad = 'loading' | 'loaded' | 'cached';

/** The fade art takes in over its ink placeholder. */
const FADE_IN = `opacity 0.2s ${EASING.smooth}`;

/**
 * How an `<img>` loads art the browser already has: at once, since a lazy one waits to be laid
 * out on screen first, which a view transition holding the prerendered page never lets it be.
 */
const HELD_ART = {loading: 'eager', decoding: 'sync'} as const;

/**
 * Art that was on screen a moment ago and is drawn again in a copy: the binder's pages a page turn
 * lifts (#942). Its art starts loaded, as art the browser already holds does. Chromium gives the
 * copy's `<img>` its image a task after it mounts (see `renderOverPrerenderedPage`), so the art
 * draws blank that long at most, where the ink placeholder would show and fade back in.
 */
export const ArtOnScreen = createContext(false);

/** Art starts loaded where a copy draws it again (`ArtOnScreen`), or where the prerendered page showed it. */
const firstLoad = (src: string | undefined, onScreen: boolean): ArtLoad =>
  onScreen || prerenderedArtShown(src) ? 'cached' : 'loading';

/**
 * Load state for card art drawn over its ink placeholder (#919). Art the browser already holds
 * starts loaded with no fade, and loads eagerly, so the app taking over from a prerendered page
 * doesn't blink it (#915): art that page showed, and art whose `<img>` is complete as it mounts,
 * as Firefox and Safari report for an image they have. Chromium reports it a frame later, too
 * late for the mount, so it relies on the first. Spread `artProps` onto the `<img>`, after its
 * own `loading` and `decoding`:
 *
 *   const {loaded, transition, artProps} = useArtLoad(src);
 *   <img src={src} loading="lazy" {...artProps} style={{opacity: loaded ? 1 : 0, transition}} />
 */
export function useArtLoad(src: string | undefined) {
  const onScreen = useContext(ArtOnScreen);
  const [load, setLoad] = useState(() => firstLoad(src, onScreen));
  const settle = (next: ArtLoad) => setLoad((current) => (current === 'loading' ? next : current));
  return {
    loaded: load !== 'loading',
    transition: load === 'cached' ? undefined : FADE_IN,
    artProps: {
      ...(load === 'cached' && HELD_ART),
      // Complete with pixels as it mounts: the browser had the art before this element did.
      ref: (img: HTMLImageElement | null) => {
        if (img?.complete && img.naturalWidth > 0) settle('cached');
      },
      onLoad: () => settle('loaded'),
    },
  } as const;
}

/** What `useArtLoad` puts on the art's `<img>`. */
export type ArtProps = ReturnType<typeof useArtLoad>['artProps'];
