#!/usr/bin/env node
/**
 * Source-map leak guard (issue #358).
 *
 * Walks a build output directory and fails (exit 1) if any `.map` file ships
 * original source inlined via `sourcesContent`. Such a map lets anyone fully
 * reconstruct the codebase by appending `.map` to a chunk URL.
 *
 * Enforced only at the deploy boundary (vercel.json `buildCommand`), where the
 * Sentry plugin runs and is expected to have uploaded + deleted app maps. A
 * failure there means the maps were NOT stripped (e.g. SENTRY_AUTH_TOKEN
 * missing) and the build would have leaked source.
 *
 * Usage: node scripts/check-sourcemaps.mjs [targetDir]   (default: apps/web/dist)
 * Bypass: SKIP_SOURCEMAP_GUARD=1  (emergency escape hatch)
 */
import {readFileSync} from 'node:fs';
import {readdir} from 'node:fs/promises';
import {join} from 'node:path';

const targetDir = process.argv[2] ?? 'apps/web/dist';

if (process.env.SKIP_SOURCEMAP_GUARD === '1') {
  console.log(`⚠ Source-map guard skipped (SKIP_SOURCEMAP_GUARD=1) for "${targetDir}".`);
  process.exit(0);
}

/** Recursively yield every `.map` file path under `dir`. */
async function* walkMaps(dir) {
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkMaps(full);
    else if (entry.name.endsWith('.map')) yield full;
  }
}

const offenders = [];

for await (const file of walkMaps(targetDir)) {
  let map;
  try {
    map = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    offenders.push({file, reason: 'unparseable .map file'});
    continue;
  }

  // A map leaks only if sourcesContent actually inlines original code: the key
  // must be an array with at least one non-empty string. An absent array, or an
  // array of only empty strings (a deliberately content-stripped map), is safe.
  // The typeof guard keeps a malformed entry (e.g. a number) from throwing.
  const leaks =
    Array.isArray(map.sourcesContent) &&
    map.sourcesContent.some((content) => typeof content === 'string' && content.length > 0);

  if (leaks) offenders.push({file, reason: 'contains sourcesContent (original code)'});
}

if (offenders.length > 0) {
  console.error(`✖ Source-map leak check failed in "${targetDir}":`);
  for (const {file, reason} of offenders) console.error(`  ${file}\n    -> ${reason}`);
  console.error(
    '\nMaps with inlined sourcesContent must not ship. Ensure SENTRY_AUTH_TOKEN is set ' +
      '(uploads + deletes app maps) or disable sourcemap generation for the offending output.',
  );
  process.exit(1);
}

console.log(`✓ No source-leaking maps in "${targetDir}".`);
