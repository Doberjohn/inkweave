import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {injectManifest} from './download-card-images.mjs';

let dir;
let dataFile;

/** Write a card data file shaped like allCards.json and return its path. */
function seed(cards) {
  fs.writeFileSync(dataFile, JSON.stringify({cards}, null, 2) + '\n');
  return dataFile;
}

const read = () => JSON.parse(fs.readFileSync(dataFile, 'utf8')).cards;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inkweave-images-'));
  dataFile = path.join(dir, 'allCards.json');
});

afterEach(() => {
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('injectManifest', () => {
  it('writes the hashes of every image emitted this build', () => {
    seed([{id: 1, fullName: 'Card One'}]);
    injectManifest(dataFile, {1: {full: 'aaaaaaaaaaaaaaaa', sm: 'bbbbbbbbbbbbbbbb'}});

    expect(read()[0]).toMatchObject({
      imageHash: 'aaaaaaaaaaaaaaaa',
      imageHashSm: 'bbbbbbbbbbbbbbbb',
    });
  });

  /**
   * The bug this guards, live on production 2026-09-23: seven cards whose art 404'd
   * upstream kept the hash committed by an earlier build. OUTPUT_DIR is wiped every
   * run and the manifest starts empty, so a hash with no manifest entry names a file
   * that was never written, and the app renders an <img> pointing at a dead URL.
   * Clearing it drops the card to the same graceful fallback a never-hashed card gets.
   */
  it('clears a stale hash when this build emitted no image for the card', () => {
    seed([{id: 1, fullName: 'Art Pulled Upstream', imageHash: 'old', imageHashSm: 'oldsm'}]);
    injectManifest(dataFile, {});

    const card = read()[0];
    expect(card.imageHash).toBeUndefined();
    expect(card.imageHashSm).toBeUndefined();
  });

  it('leaves the rest of a card untouched while clearing its hashes', () => {
    seed([{id: 1, fullName: 'Art Pulled Upstream', cost: 4, imageHash: 'old'}]);
    injectManifest(dataFile, {});

    expect(read()[0]).toEqual({id: 1, fullName: 'Art Pulled Upstream', cost: 4});
  });

  it('reports how many cards it hashed', () => {
    seed([{id: 1}, {id: 2}, {id: 3, imageHash: 'stale'}]);
    const updated = injectManifest(dataFile, {1: {full: 'f1', sm: 's1'}, 2: {full: 'f2', sm: 's2'}});

    expect(updated).toBe(2);
  });
});
