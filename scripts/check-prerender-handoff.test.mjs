import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {routesOf} from './check-prerender-handoff.mjs';

let dist;

/**
 * A sample crawl in miniature: a home page linking a card, two card pages, the first without
 * synergies (so precompute wrote no file for it), and a playstyle.
 */
beforeEach(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-routes-'));
  const write = (rel, text = '') => {
    fs.mkdirSync(path.dirname(path.join(dist, rel)), {recursive: true});
    fs.writeFileSync(path.join(dist, rel), text);
  };
  write('index.html', '<a class="tile" href="/card/1001/stitch-carefree-surfer">Stitch</a>');
  write('card/1001/stitch-carefree-surfer/index.html');
  write('card/1989/elsa-snow-queen/index.html');
  write('playstyles/index.html');
  write('playstyles/bounce/index.html');
  const groups = [{groupKey: 'shift', synergies: [{cardId: '1990'}]}];
  write('data/synergies/1989.json', JSON.stringify({groups}));
});

afterEach(() => {
  fs.rmSync(dist, {recursive: true, force: true});
});

describe('routesOf', () => {
  it('visits the first card page with a synergy file, for a compare link to its partner', () => {
    const {withoutCapture, withCapture} = routesOf(dist);
    expect(withoutCapture).toContain('/compare/1989/1990/shift');
    expect(withCapture).toContain('/card/1989/elsa-snow-queen');
  });

  it('says why when no card page has a synergy file', () => {
    fs.rmSync(path.join(dist, 'data', 'synergies', '1989.json'));
    expect(() => routesOf(dist)).toThrow('no card page');
  });

  it("follows the home page's first card link during the hold", () => {
    expect(routesOf(dist).homeLink).toBe('/card/1001/stitch-carefree-surfer');
  });

  it('says why when the home page links no card', () => {
    fs.writeFileSync(path.join(dist, 'index.html'), '<a href="/browse">Browse</a>');
    expect(() => routesOf(dist)).toThrow('no card link');
  });
});
