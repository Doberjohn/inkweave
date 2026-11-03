#!/usr/bin/env node
/**
 * Generates middleware-data/card-slugs.json: a compact { "<id>": "<slug>" } map consumed by the
 * root middleware.ts, which 308s a card URL without its current slug to /card/:id/:slug and
 * answers an id the map lacks with a 404. Built from the SAME engine `cardSlug` the app, sitemap,
 * and prerender use, so the redirect target always matches a prerendered slug page. It holds the
 * preview cards too, since the app gives each its card page and an id left out would 404.
 *
 * Committed AND regenerated in build:vercel, so `vercel build` always finds the map when it
 * compiles the middleware, regardless of build-step ordering.
 *
 * Usage: node scripts/generate-card-slug-map.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CARD_FILES = ['allCards.json', 'previewCards.json'].map((file) =>
  path.join(ROOT, 'apps/web/public/data', file),
);
const OUTPUT_FILE = path.join(ROOT, 'middleware-data/card-slugs.json');

async function main() {
  const enginePath = path.join(ROOT, 'packages', 'synergy-engine', 'dist', 'index.js');
  const {cardSlug} = await import(new URL(`file:///${enginePath.replace(/\\/g, '/')}`).href);
  // previewCards.json is absent or empty out of reveal season.
  const cards = CARD_FILES.filter((file) => fs.existsSync(file)).flatMap(
    (file) => JSON.parse(fs.readFileSync(file, 'utf8')).cards,
  );

  const map = {};
  for (const c of cards) map[c.id] = cardSlug(c);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), {recursive: true});
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(map) + '\n', 'utf8');
  console.log(`card-slugs.json: ${cards.length} id->slug entries written to middleware-data/card-slugs.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
