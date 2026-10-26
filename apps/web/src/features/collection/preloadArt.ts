import {markArtDrawn} from 'inkweave-ui/hooks/useArtLoad';

/** Art loaded ahead, by its URL: its image while it decodes, held so the browser keeps it, then null. */
const ahead = new Map<string, HTMLImageElement | null>();

/**
 * How many art loads ahead run at once. Over HTTP/1.1 the browser opens six connections to a
 * host, and a load ahead holds one until its art comes: 24 at once held all six, so a card
 * window's code, asked for next, never came (CI, PR #1002). Two leave the rest to the page.
 */
const AT_ONCE = 2;

/** The art still to load ahead, in order, and how many loads are running. */
let waiting: string[] = [];
let running = 0;

/**
 * Loads art before its `<img>` mounts, as the binder does for the pages either side of the one in
 * view (owner, 2026-10-26): two at a time, at low priority, behind the art in view. Each call
 * replaces the art still waiting, so a reader paging fast only loads ahead of where they are.
 * Once decoded, art counts as drawn (`markArtDrawn`), so the pocket that shows it starts with it.
 * Art that fails to load is left to its `<img>` to fail, and is asked for again next time. Here,
 * not beside `useArtLoad`, so it ships in the binder's chunk, not at startup.
 */
export function preloadArt(srcs: readonly string[]) {
  waiting = srcs.filter((src) => !ahead.has(src));
  loadNext();
}

function loadNext() {
  while (running < AT_ONCE && waiting.length > 0) {
    const src = waiting.shift()!;
    if (!ahead.has(src)) load(src);
  }
}

function load(src: string) {
  running += 1;
  const img = new Image();
  img.fetchPriority = 'low';
  img.src = src;
  ahead.set(src, img);
  const settle = (drawn: boolean) => {
    if (drawn) {
      ahead.set(src, null);
      markArtDrawn(src);
    } else {
      ahead.delete(src);
    }
    running -= 1;
    loadNext();
  };
  img.decode().then(
    () => settle(true),
    () => settle(false),
  );
}
