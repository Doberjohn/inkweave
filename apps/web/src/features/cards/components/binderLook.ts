import type {CSSProperties} from 'react';
import {blackRgba, EASING, hexRgba, whiteRgba} from '../../../shared/constants';

/** One weld dot every 4 units round a 10-unit square: `border-image` slices it 2 deep, a dot per corner and one per side. */
const WELD_DOTS = [
  [1, 1],
  [5, 1],
  [9, 1],
  [1, 5],
  [9, 5],
  [1, 9],
  [5, 9],
  [9, 9],
];

const WELD_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><g fill='white' fill-opacity='.3'>${WELD_DOTS.map(([x, y]) => `<circle cx='${x}' cy='${y}' r='.85'/>`).join('')}</g></svg>`;

/** A foil's rainbow bands, repeating along a slant. */
const HOLO_BANDS = ['#ff5cba 0%', '#ffd65c 7%', '#5cffc4 14%', '#5ca4ff 21%', '#c45cff 28%', '#ff5cba 35%'];

/**
 * The collection binder's look (#941): black pro pages of clear pockets in a zip binder's
 * board, as the owner picked it on 2026-10-24. Custom properties for `binder.css`, which holds
 * only `var()`s, spread on the binder's section the way `CARD_TILE_GLOW` is spread on a tile.
 *
 * BESIDE THE BINDER, NOT IN THEME.TS: only `BinderSpread` imports it, so these strings (the
 * weld and the holo the heaviest) load with the binder's own code, never at startup.
 *
 * THE BLACKS ARE EACH A STEP FROM THE PAGE'S BACKGROUND ON PURPOSE: the board a shade lighter,
 * so it reads against the page round it; the zip's tape and the gaps between the sheets darker,
 * so they read against the board.
 */
export const BINDER_LOOK = {
  // The board the pages sit in: a fine grain over near-black, lifted off the page by its shadow.
  '--binder-board': '#101015',
  '--binder-board-grain': whiteRgba(0.05),
  '--binder-board-drop': blackRgba(0.85),
  '--binder-board-rim': whiteRgba(0.07),
  '--binder-board-line': whiteRgba(0.04),
  // The zip round its outer edge: metal teeth on a dark tape, and its pull.
  '--binder-zip-teeth': '#8a8a9c',
  '--binder-zip-tape': '#0a0a0e',
  '--binder-zip-pull': 'linear-gradient(180deg, #b9b9c8, #6c6c7c 60%, #55556a)',
  '--binder-zip-slot': '#2a2a34',
  '--binder-zip-drop': blackRgba(0.6),
  // A pro page: black, textured, a little light from the top left, shaded toward the spine.
  '--binder-page': '#121217',
  '--binder-page-grain': whiteRgba(0.075),
  '--binder-page-light': whiteRgba(0.05),
  '--binder-page-shade': blackRgba(0.9),
  // The sheets under a page, seen edge on: clear plastic catching the light, dark between them.
  '--binder-sheet-edge': '#3a3a46',
  '--binder-sheet-gap': '#08080b',
  '--binder-sheet-shadow': blackRgba(0.6),
  // A pocket's frosted sleeve, behind its card.
  '--binder-sleeve': hexRgba('#bec4d6', 0.1),
  '--binder-sleeve-grain': whiteRgba(0.11),
  '--binder-sleeve-light': whiteRgba(0.26),
  '--binder-sleeve-rim': whiteRgba(0.1),
  '--binder-sleeve-line': blackRgba(0.75),
  // Its clear front sheet, over the card: welded to the next pocket, cut open at the top.
  '--binder-weld': `url("data:image/svg+xml,${encodeURIComponent(WELD_SVG)}")`,
  '--binder-cut': whiteRgba(0.42),
  '--binder-cut-shadow': blackRgba(0.5),
  '--binder-sheen': `linear-gradient(160deg, ${whiteRgba(0.13)}, ${whiteRgba(0.035)} 30%, ${whiteRgba(0.015)} 60%, ${whiteRgba(0.04)})`,
  // A foil's holo finish: two grids of glints (5px and 7px, so they never read as a screen) over the bands.
  '--binder-holo': [
    `radial-gradient(circle, ${whiteRgba(0.9)} 0 0.5px, transparent 1px) 0 0 / 5px 5px`,
    `radial-gradient(circle, ${whiteRgba(0.7)} 0 0.5px, transparent 1px) 2px 3px / 7px 7px`,
    `repeating-linear-gradient(125deg, ${HOLO_BANDS.join(', ')})`,
  ].join(', '),
  // A card sliding in, and its colour coming in or draining out.
  '--binder-motion': EASING.smooth,
} as CSSProperties;
