import type {Locator, Page} from '@playwright/test';
import {expect} from '../fixtures';

/**
 * Reading the page as it is drawn: where an element's box sits, and the pixels inside a part of
 * the screen, for what no computed style can say (whether a layer drawn under the binder's pages
 * shows at all, what colour a glow comes out, how far a text stands out from its ground).
 */

export type Place = {x: number; y: number; width: number; height: number};

/** An element's box on the page, once the page's fonts are in. */
export async function placeOf(locator: Locator): Promise<Place> {
  await locator.page().evaluate(() => document.fonts.ready.then(() => undefined));
  const box = await locator.boundingBox();
  expect(box, 'the element is on the page').not.toBeNull();
  return box!;
}

/** Where an element's four edges sit on the page, in CSS pixels. */
export async function edges(locator: Locator): Promise<{left: number; right: number; top: number; bottom: number}> {
  const box = await locator.boundingBox();
  expect(box, 'the element is on the page').not.toBeNull();
  return {left: box!.x, right: box!.x + box!.width, top: box!.y, bottom: box!.y + box!.height};
}

/** Where a box's middle sits across the page, from its `edges`. */
export const middle = (box: {left: number; right: number}) => (box.left + box.right) / 2;

export type Rgb = [number, number, number];

/** The page's pixels in `clip`, row by row: a screenshot, decoded by the page's own canvas. */
export async function pixelsIn(page: Page, clip: Place): Promise<Rgb[][]> {
  const png = await page.screenshot({clip});
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('pixelsIn: no 2d canvas');
    context.drawImage(image, 0, 0);
    const {data, width, height} = context.getImageData(0, 0, canvas.width, canvas.height);
    return Array.from({length: height}, (_, y) =>
      Array.from({length: width}, (_, x): [number, number, number] => {
        const i = (y * width + x) * 4;
        return [data[i], data[i + 1], data[i + 2]];
      }),
    );
  }, png.toString('base64'));
}

/** A pixel's luminance, 0 to 255. */
export const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** The average colour of `clip`. */
export async function colourOf(page: Page, clip: Place): Promise<Rgb> {
  const pixels = (await pixelsIn(page, clip)).flat();
  const sum = pixels.reduce<Rgb>((total, [r, g, b]) => [total[0] + r, total[1] + g, total[2] + b], [0, 0, 0]);
  return sum.map((channel) => channel / pixels.length) as Rgb;
}

/** The lightest pixel in `clip`: a light text's own colour, at the heart of its strokes. */
export async function lightestIn(page: Page, clip: Place): Promise<Rgb> {
  const pixels = (await pixelsIn(page, clip)).flat();
  return pixels.reduce((lightest, pixel) => (luminance(pixel) > luminance(lightest) ? pixel : lightest));
}

/** How far apart two reads of the same clip are: the mean gap across every pixel's channels, 0 to 255. */
export function meanDifference(a: Rgb[][], b: Rgb[][]): number {
  const [first, second] = [a.flat(), b.flat()];
  const gaps = first.flatMap((pixel, i) => pixel.map((channel, c) => Math.abs(channel - second[i][c])));
  return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
}

/** WCAG's contrast ratio between two colours, 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const lightness = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  const [light, dark] = [lightness(a), lightness(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
