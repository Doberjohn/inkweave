import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {selectSampleCards, findOffenders, SITE_ORIGIN} from './check-rendered-html.mjs';

/** Stand-in for the engine's cardPath — same shape, no engine dist needed. */
const cardPath = (c) => `/card/${c.id}/${c.slug}`;

const CARD = {id: 1989, slug: 'elsa-snow-queen', fullName: 'Elsa - Snow Queen'};

/** A prerendered card page as the crawl actually writes it. */
const goodCardHtml = (card) =>
  `<!doctype html><html><head><title>${card.fullName} | Lorcana Synergies | Inkweave</title>` +
  `<link rel="canonical" href="${SITE_ORIGIN}${cardPath(card)}"/></head>` +
  `<body><h1>${card.fullName}</h1></body></html>`;

/** The SPA shell Vercel's rewrite serves when no prerendered file exists. */
const shellHtml = `<!doctype html><html><head><title>Inkweave — Master Lorcana Synergies</title>` +
  `<link rel="canonical" href="${SITE_ORIGIN}/"/></head><body><div id="root"></div></body></html>`;

let dist;

/** Write a well-formed build output; individual tests then break one thing. */
function seedGoodBuild(card = CARD) {
  const cardDir = path.join(dist, 'card', String(card.id), card.slug);
  fs.mkdirSync(cardDir, {recursive: true});
  fs.writeFileSync(path.join(cardDir, 'index.html'), goodCardHtml(card));

  const browseDir = path.join(dist, 'browse');
  fs.mkdirSync(browseDir, {recursive: true});
  fs.writeFileSync(
    path.join(browseDir, 'index.html'),
    `<!doctype html><html><body><a href="/card/${card.id}/${card.slug}">${card.fullName}</a></body></html>`,
  );
}

beforeEach(() => {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), 'render-guard-'));
});

afterEach(() => {
  fs.rmSync(dist, {recursive: true, force: true});
});

describe('selectSampleCards', () => {
  const corpus = (n) => Array.from({length: n}, (_, i) => ({id: i, fullName: `card ${i}`}));

  it('spreads across the corpus instead of sampling only the head', () => {
    const picked = selectSampleCards(corpus(1024));
    const indices = picked.map((c) => c.id);
    expect(indices[0]).toBe(0);
    expect(new Set(indices).size).toBe(indices.length);
    expect(Math.max(...indices)).toBeGreaterThan(800);
  });

  it('always includes the tail, where a killed crawl stops writing', () => {
    const cards = corpus(1024);
    expect(selectSampleCards(cards)).toContain(cards.at(-1));
  });

  it('is deterministic — two calls pick the same pages', () => {
    const cards = corpus(1024);
    expect(selectSampleCards(cards)).toEqual(selectSampleCards(cards));
  });

  it('degrades safely on corpora smaller than the sample size', () => {
    expect(selectSampleCards(corpus(0))).toHaveLength(0);
    expect(selectSampleCards(corpus(1))).toHaveLength(1);
    expect(selectSampleCards(corpus(3))).toHaveLength(3);
  });
});

describe('findOffenders', () => {
  it('passes a well-formed build', () => {
    seedGoodBuild();
    expect(findOffenders(dist, [CARD], cardPath)).toEqual([]);
  });

  it('fails when the card page was never written (crawl did not run)', () => {
    seedGoodBuild();
    fs.rmSync(path.join(dist, 'card'), {recursive: true});
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/missing/);
  });

  it('fails when the card page is an SPA shell carrying the homepage canonical', () => {
    seedGoodBuild();
    fs.writeFileSync(path.join(dist, 'card', '1989', 'elsa-snow-queen', 'index.html'), shellHtml);
    const reasons = findOffenders(dist, [CARD], cardPath).map((o) => o.reason);
    // Both signals fire: no card name in the body, and a non-self-referential canonical.
    expect(reasons.some((r) => r.includes('Elsa - Snow Queen'))).toBe(true);
    expect(reasons.some((r) => r.includes(`${SITE_ORIGIN}/card/1989/elsa-snow-queen`))).toBe(true);
  });

  it('fails when /browse links no card URLs', () => {
    seedGoodBuild();
    fs.writeFileSync(path.join(dist, 'browse', 'index.html'), shellHtml);
    const offenders = findOffenders(dist, [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/no \/card\/ URLs/);
  });

  it('reports every offender at once rather than stopping at the first', () => {
    // Nothing seeded: both the card page and /browse are missing.
    expect(findOffenders(dist, [CARD], cardPath).length).toBeGreaterThan(1);
  });

  it('distinguishes a wrong target path from a failed crawl', () => {
    const offenders = findOffenders(path.join(dist, 'no-such-dir'), [CARD], cardPath);
    expect(offenders).toHaveLength(1);
    expect(offenders[0].reason).toMatch(/wrong path/);
  });
});
