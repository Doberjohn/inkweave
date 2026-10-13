/**
 * Matches the rule docs to their coverage specs and fills each doc's blocks (#479).
 *
 * A spec is {doc, blocks}: the doc's file name and a render function per block name, each
 * taking the coverage context from stats.mjs and returning the block's markdown.
 */
import {blockNames, fillBlocks} from './markers.mjs';

const listed = (names) => names.join(', ');

/**
 * Throws unless every rule doc has a spec and every spec has a doc, so a new rule doc can't
 * skip its coverage and a renamed one can't leave a spec behind.
 *
 * @param {string[]} docs - the *_RULE.md file names on disk
 * @param {Array<{doc: string}>} specs
 */
export function checkSpecs(docs, specs) {
  const specDocs = specs.map((spec) => spec.doc);
  const missing = docs.filter((doc) => !specDocs.includes(doc));
  if (missing.length > 0) {
    throw new Error(
      `no coverage spec for ${listed(missing)} (add one in scripts/lib/rule-coverage/specs/)`,
    );
  }
  const orphans = specDocs.filter((doc) => !docs.includes(doc));
  if (orphans.length > 0)
    throw new Error(`coverage specs name docs that don't exist: ${listed(orphans)}`);
}

/**
 * A doc with its blocks filled from its spec. Throws when the doc's blocks and the spec's
 * differ, so a marker pair can't go unfilled and a spec block can't go unshown.
 *
 * @param {string} text - the doc
 * @param {{doc: string, blocks: Record<string, (coverage: object) => string>}} spec
 * @param {object} coverage - from createCoverage
 * @returns {string}
 */
export function refreshDoc(text, spec, coverage) {
  const names = blockNames(text, spec.doc);
  const expected = Object.keys(spec.blocks);
  const unfilled = names.filter((name) => !expected.includes(name));
  if (unfilled.length > 0) throw new Error(`${spec.doc}: no spec for block ${listed(unfilled)}`);
  const unshown = expected.filter((name) => !names.includes(name));
  if (unshown.length > 0) throw new Error(`${spec.doc}: no markers for block ${listed(unshown)}`);
  return fillBlocks(text, (name) => spec.blocks[name](coverage));
}
