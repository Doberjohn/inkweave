#!/usr/bin/env node
/**
 * Generates middleware/card-slugs.json: a compact { "<id>": "<slug>" } map consumed by the root
 * middleware.ts, which 301-redirects bare numeric /card/:id URLs to their canonical slug URL
 * /card/:id/:slug (#498 Phase 1 follow-up). Built from the SAME engine `cardSlug` the app,
 * sitemap, and prerender use, so the redirect target always matches a prerendered slug page.
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
const CARDS_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const OUTPUT_FILE = path.join(ROOT, 'middleware-data/card-slugs.json');

async function main() {
  const enginePath = path.join(ROOT, 'packages', 'synergy-engine', 'dist', 'index.js');
  const {cardSlug} = await import(new URL(`file:///${enginePath.replace(/\\/g, '/')}`).href);
  const {cards} = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));

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
