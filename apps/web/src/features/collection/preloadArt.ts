import {markArtDrawn} from '../../shared/hooks/useArtLoad';

/** Art loaded ahead, by its URL: its image while it decodes, held so the browser keeps it, then null. */
const ahead = new Map<string, HTMLImageElement | null>();

/**
 * Loads art before its `<img>` mounts, as the binder does for the pages either side of the one in
 * view (owner, 2026-10-26). Once decoded it counts as drawn (`markArtDrawn`), so the pocket that
 * shows it starts with it. Art that fails to load is left to its `<img>` to fail, and is asked for
 * again next time. Here, not beside `useArtLoad`, so it ships in the binder's chunk, not at startup.
 */
export function preloadArt(src: string) {
  if (ahead.has(src)) return;
  const img = new Image();
  img.src = src;
  ahead.set(src, img);
  img.decode().then(
    () => {
      ahead.set(src, null);
      markArtDrawn(src);
    },
    () => ahead.delete(src),
  );
}
