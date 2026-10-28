// @vitest-environment node
// The two grandfather ledgers only shrink (#508): KNOWN_OFFENDERS, the files each design-token
// rule still lets through, and known-design-values.json, check:design's per-file value counts. A
// file that moves (into inkweave-ui, #978) must take its entries along, never gain new ones, so
// each total holds at a ceiling. Lower a ceiling when an entry goes; never raise one. The baseline's
// ceiling rose once (#1013): check:design began counting the 56 radii, font sizes, shadows and
// durations typed into .css files, values there all along, so the total went from 205 to 261 and
// the ceiling from 207 to that exact total.
import {readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {KNOWN_OFFENDERS} from './known-offenders.js';

const LEDGER_CEILING = 137;
const BASELINE_CEILING = 261;

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const BASELINE = JSON.parse(
  readFileSync(new URL('../scripts/known-design-values.json', import.meta.url), 'utf8'),
);
const RAW_ENTRY = ' (raw)';
const SCALE_ENTRY = ' (scale)';
const isFile = (path) => statSync(REPO + path, {throwIfNoEntry: false})?.isFile() === true;

describe('the grandfather ledgers', () => {
  it(`holds KNOWN_OFFENDERS at ${LEDGER_CEILING} rows or fewer`, () => {
    const rows = Object.values(KNOWN_OFFENDERS).reduce((total, files) => total + files.length, 0);
    expect(rows).toBeLessThanOrEqual(LEDGER_CEILING);
  });

  it.each(Object.entries(KNOWN_OFFENDERS))('lists each %s file once', (_rule, files) => {
    expect(files.filter((file, index) => files.indexOf(file) !== index)).toEqual([]);
  });

  it(`holds the design-value baseline at ${BASELINE_CEILING} values or fewer`, () => {
    const values = Object.values(BASELINE).reduce((total, count) => total + count, 0);
    expect(values).toBeLessThanOrEqual(BASELINE_CEILING);
  });

  it.each(Object.keys(BASELINE))('the baseline names %s, a file in the repo', (key) => {
    expect(isFile(key.replace(RAW_ENTRY, '').replace(SCALE_ENTRY, ''))).toBe(true);
  });
});
