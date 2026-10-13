/**
 * The generated blocks in a synergy-rule doc (#479). A block is everything between
 *
 *   <!-- coverage:start NAME -->
 *   <!-- coverage:end -->
 *
 * each marker on a line of its own. refresh-rule-coverage.mjs rewrites what sits between them
 * and never touches the prose outside.
 */

const START = /<!-- coverage:start ([a-z0-9-]+) -->/g;
const END = /<!-- coverage:end -->/g;
// A block's content never contains a marker, so one block can't run on into the next.
const BLOCK =
  /<!-- coverage:start ([a-z0-9-]+) -->\n(?:(?:(?!<!-- coverage:)[\s\S])*\n)?<!-- coverage:end -->/g;

// A whole marker line. Anything else on it (indent, trailing space, a CR) would hide the block.
const MARKER_LINE = /^<!-- coverage:(?:start [a-z0-9-]+|end) -->$/;

const count = (text, pattern) => [...text.matchAll(pattern)].length;

/**
 * The names of a doc's blocks, in order. Throws when a marker shares its line or misspells its
 * name, and when the markers don't pair up: a start with no end, a stray end, a block inside a
 * block, or two blocks with one name.
 *
 * @param {string} text - the doc, with LF line endings
 * @param {string} doc - its file name, for the error
 * @returns {string[]}
 */
export function blockNames(text, doc) {
  const loose = text
    .split('\n')
    .find((line) => line.includes('<!-- coverage:') && !MARKER_LINE.test(line));
  if (loose !== undefined) {
    throw new Error(
      `${doc}: coverage marker line ${JSON.stringify(loose)} must hold the marker alone, ` +
        'named with a-z, 0-9 and -',
    );
  }
  const names = [...text.matchAll(BLOCK)].map((m) => m[1]);
  const balanced = names.length === count(text, START) && names.length === count(text, END);
  if (!balanced) throw new Error(`${doc}: unbalanced coverage markers`);
  const repeated = names.find((name, i) => names.indexOf(name) !== i);
  if (repeated) throw new Error(`${doc}: two coverage blocks are named ${repeated}`);
  return names;
}

/**
 * The doc with each block's content replaced by what `render` returns for its name. A block's
 * content is the rendered text, trimmed, so a second run over the same data changes nothing.
 *
 * @param {string} text - the doc
 * @param {(name: string) => string} render - a block's new content
 * @returns {string}
 */
export function fillBlocks(text, render) {
  return text.replace(
    BLOCK,
    (_, name) => `<!-- coverage:start ${name} -->\n${render(name).trim()}\n<!-- coverage:end -->`,
  );
}
