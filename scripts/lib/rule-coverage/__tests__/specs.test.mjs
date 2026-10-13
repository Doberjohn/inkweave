import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {blockNames} from '../markers.mjs';
import {checkSpecs} from '../refresh.mjs';
import {SPECS} from '../specs/index.mjs';

const DOCS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/synergy-engine',
);
const DOCS = fs.readdirSync(DOCS_DIR).filter((file) => file.endsWith('_RULE.md'));
const TEXTS = new Map(DOCS.map((doc) => [doc, fs.readFileSync(path.join(DOCS_DIR, doc), 'utf8')]));

describe('coverage specs', () => {
  it('cover every rule doc, and only rule docs that exist', () => {
    expect(() => checkSpecs(DOCS, SPECS)).not.toThrow();
  });

  it.each(SPECS.map((spec) => [spec.doc, spec]))(
    '%s marks exactly the blocks its spec renders',
    (doc, spec) => {
      expect(blockNames(TEXTS.get(doc), doc).sort()).toEqual(Object.keys(spec.blocks).sort());
    },
  );
});
