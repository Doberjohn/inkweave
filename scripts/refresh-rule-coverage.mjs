#!/usr/bin/env node
/**
 * Regenerates the coverage blocks in packages/synergy-engine/*_RULE.md from the live engine and
 * card pool (#479): role populations, unique pairs and score distributions, never typed by hand.
 *
 * Each doc marks its generated parts with `<!-- coverage:start NAME -->` and
 * `<!-- coverage:end -->`; what each block shows is its spec in scripts/lib/rule-coverage/specs/.
 * Prose outside the markers is never touched, and a doc is written only when a block changed, so
 * a second run, or a run after an engine edit that moves no number, leaves the docs as they are.
 *
 * Pairs come from the engine itself, not the precomputed JSON, whose groups stop at the engine's
 * display cap. The pool is the one precompute-synergies.mjs ships: allCards.json plus the cards
 * previewCards.json adds, cut to Core sets.
 *
 * Usage:
 *   pnpm refresh-rule-coverage                # builds the engine first
 *   node scripts/refresh-rule-coverage.mjs    # uses packages/synergy-engine/dist as built
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {checkSpecs, refreshDoc} from './lib/rule-coverage/refresh.mjs';
import {SPECS} from './lib/rule-coverage/specs/index.mjs';
import {buildPool, createCoverage} from './lib/rule-coverage/stats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = path.join(ROOT, 'packages/synergy-engine');
const ENGINE = path.join(DOCS_DIR, 'dist/index.js');
const MAIN_DATA_FILE = path.join(ROOT, 'apps/web/public/data/allCards.json');
const PREVIEW_DATA_FILE = path.join(ROOT, 'apps/web/public/data/previewCards.json');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf-8'));

async function main() {
  if (!fs.existsSync(ENGINE)) throw new Error('Engine not built. Run `pnpm build:engine` first.');
  const engine = await import(pathToFileURL(ENGINE).href);
  const preview = fs.existsSync(PREVIEW_DATA_FILE) ? readJson(PREVIEW_DATA_FILE) : null;
  const pool = buildPool({main: readJson(MAIN_DATA_FILE), preview, engine});
  const coverage = createCoverage({engine, pool});

  const docs = fs.readdirSync(DOCS_DIR).filter((file) => file.endsWith('_RULE.md'));
  checkSpecs(docs, SPECS);
  const changed = [];
  for (const spec of SPECS) {
    const file = path.join(DOCS_DIR, spec.doc);
    const text = fs.readFileSync(file, 'utf-8');
    // .gitattributes checks docs out with LF, but an editor may save one with CRLF: read it as LF
    // and write it back with the endings it had, so a run never rewrites a doc for its endings alone.
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const next = refreshDoc(text.replace(/\r\n/g, '\n'), spec, coverage).replace(/\n/g, eol);
    if (next === text) continue;
    fs.writeFileSync(file, next);
    changed.push(spec.doc);
  }
  const summary = changed.length > 0 ? `updated ${changed.join(', ')}` : 'all docs up to date';
  console.log(`Rule coverage over ${pool.cards.length} Core cards (${pool.label}): ${summary}`);
}

main().catch((error) => {
  console.error(`refresh-rule-coverage: ${error.message}`);
  process.exit(1);
});
