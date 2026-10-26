import {vi} from 'vitest';
import {rememberPrerenderedArt} from '../lib/prerenderedArt';

/**
 * Makes every `<img>` report art the browser already holds, as Firefox and Safari report the
 * prerendered page's art to the app's `<img>`s (#915). Tests import it from this file, not the
 * barrel, which stories load too. Undo it with `vi.restoreAllMocks()`.
 */
export function stubLoadedArt(naturalWidth = 488): void {
  vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
  vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(naturalWidth);
}

/**
 * Has a prerendered page show the art at `srcs` as the app takes over from it (#915), while the
 * app's own `<img>`s report nothing loaded as they mount, as in Chromium. Undo it with
 * `_resetPrerenderedArt()`.
 */
export function showPrerenderedArt(...srcs: string[]): void {
  const page = document.createElement('div');
  page.setAttribute('data-ready', '');
  for (const src of srcs) page.append(Object.assign(document.createElement('img'), {src}));
  const stubs = [
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true),
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(488),
    // jsdom sets no current source without a canvas package.
    vi.spyOn(HTMLImageElement.prototype, 'currentSrc', 'get').mockImplementation(function (
      this: HTMLImageElement,
    ) {
      return this.src;
    }),
  ];
  rememberPrerenderedArt(page);
  for (const stub of stubs) stub.mockRestore();
}
