/**
 * Read and write the card data files whole (`apps/web/public/data/*.json`), for the scripts that
 * rewrite them: sync-variants and merge-promo-printings (#805).
 */
import fs from 'node:fs';

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * Replaces `file` whole: the JSON goes to a temporary file beside it, then a rename swaps it in,
 * so an interrupted run leaves the old file rather than half-written JSON. Indented, or on one
 * line with `compact`, as the collection's files are written (generate-collection-data.mjs).
 */
export function writeJson(file, data, {compact = false} = {}) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, compact ? undefined : 2) + '\n');
  fs.renameSync(tmp, file);
}
