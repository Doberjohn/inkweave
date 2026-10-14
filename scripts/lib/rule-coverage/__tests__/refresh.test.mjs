import {describe, it, expect} from 'vitest';
import {blockNames, fillBlocks} from '../markers.mjs';
import {checkSpecs, refreshDoc} from '../refresh.mjs';

const block = (name, body = '') => `<!-- coverage:start ${name} -->\n${body}<!-- coverage:end -->`;
const DOC = `# Rule\n\nProse before.\n\n${block('roles', 'old roles\n')}\n\nProse between.\n${block('pairs')}\n`;
const ADJACENT = `${block('a', 'old a\n')}\n${block('b', 'old b\n')}\n`;

describe('blockNames', () => {
  it('lists the blocks in order', () => {
    expect(blockNames(DOC, 'X_RULE.md')).toEqual(['roles', 'pairs']);
  });

  it('keeps adjacent blocks apart', () => {
    expect(blockNames(ADJACENT, 'X_RULE.md')).toEqual(['a', 'b']);
  });

  it.each([
    ['a start with no end', `${block('a')}\n<!-- coverage:start b -->\n`],
    ['a stray end', `${block('a')}\n<!-- coverage:end -->\n`],
    [
      'a block inside a block',
      '<!-- coverage:start a -->\n<!-- coverage:start b -->\n<!-- coverage:end -->\n',
    ],
  ])('rejects %s', (_, text) => {
    expect(() => blockNames(text, 'X_RULE.md')).toThrow('X_RULE.md: unbalanced coverage markers');
  });

  it.each([
    ['a space after a start marker', `<!-- coverage:start a --> \n<!-- coverage:end -->\n`],
    ['an indented end marker', `<!-- coverage:start a -->\n  <!-- coverage:end -->\n`],
    ['a CRLF line ending', `<!-- coverage:start a -->\r\n<!-- coverage:end -->\r\n`],
    ['a name with a capital', `<!-- coverage:start Roles -->\n<!-- coverage:end -->\n`],
  ])('names the marker line for %s, not the balance', (_, text) => {
    expect(() => blockNames(text, 'X_RULE.md')).toThrow(
      /^X_RULE\.md: coverage marker line ".*" must hold the marker alone/,
    );
  });

  it('rejects two blocks with one name', () => {
    expect(() => blockNames(`${block('a')}\n${block('a')}\n`, 'X_RULE.md')).toThrow(
      'two coverage blocks are named a',
    );
  });
});

describe('fillBlocks', () => {
  it('replaces only what sits between the markers, and a second pass changes nothing', () => {
    const once = fillBlocks(DOC, (name) => `new ${name}\n\n`);
    expect(once).toBe(
      `# Rule\n\nProse before.\n\n${block('roles', 'new roles\n')}\n\nProse between.\n${block('pairs', 'new pairs\n')}\n`,
    );
    expect(fillBlocks(once, (name) => `new ${name}`)).toBe(once);
  });

  it('fills adjacent blocks one by one', () => {
    expect(fillBlocks(ADJACENT, (name) => `new ${name}`)).toBe(
      `${block('a', 'new a\n')}\n${block('b', 'new b\n')}\n`,
    );
  });
});

describe('checkSpecs', () => {
  it('names a rule doc with no spec', () => {
    expect(() => checkSpecs(['A_RULE.md', 'B_RULE.md'], [{doc: 'A_RULE.md'}])).toThrow(
      'no coverage spec for B_RULE.md',
    );
  });

  it('names a doc that two specs claim', () => {
    expect(() => checkSpecs(['A_RULE.md'], [{doc: 'A_RULE.md'}, {doc: 'A_RULE.md'}])).toThrow(
      'more than one coverage spec names A_RULE.md',
    );
  });

  it('names a spec whose doc is gone', () => {
    expect(() => checkSpecs(['A_RULE.md'], [{doc: 'A_RULE.md'}, {doc: 'OLD_RULE.md'}])).toThrow(
      "coverage specs name docs that don't exist: OLD_RULE.md",
    );
  });
});

describe('refreshDoc', () => {
  const render = (name) => () => `${name} from the engine`;

  it("fills each block from the spec's render function", () => {
    const spec = {doc: 'X_RULE.md', blocks: {roles: render('roles'), pairs: render('pairs')}};
    expect(blockNames(refreshDoc(DOC, spec, {}), spec.doc)).toEqual(['roles', 'pairs']);
    expect(refreshDoc(DOC, spec, {})).toContain(block('pairs', 'pairs from the engine\n'));
  });

  it('rejects a marked block the spec does not render', () => {
    const spec = {doc: 'X_RULE.md', blocks: {roles: render('roles')}};
    expect(() => refreshDoc(DOC, spec, {})).toThrow('X_RULE.md: no spec for block pairs');
  });

  it('names the doc and block when a block fails to render', () => {
    const fail = () => {
      throw new Error('roleFn is not a function');
    };
    const spec = {doc: 'X_RULE.md', blocks: {roles: render('roles'), pairs: fail}};
    expect(() => refreshDoc(DOC, spec, {})).toThrow(
      'X_RULE.md block pairs: roleFn is not a function',
    );
  });

  it('rejects a spec block the doc has no markers for', () => {
    const spec = {
      doc: 'X_RULE.md',
      blocks: {roles: render('roles'), pairs: render('pairs'), extra: render('extra')},
    };
    expect(() => refreshDoc(DOC, spec, {})).toThrow('X_RULE.md: no markers for block extra');
  });
});
