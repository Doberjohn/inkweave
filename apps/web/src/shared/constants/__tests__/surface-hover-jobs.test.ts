// @vitest-environment node
import {describe, it, expect} from 'vitest';
import {readFileSync, readdirSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import {COLORS} from '../index';

/**
 * `COLORS.surfaceHover` is the hover and highlight fill (owner, 2026-11-03, #1103): its colour's
 * other jobs take `neutralFill`, `subtleBorder` and `skeletonHighlight`, so each can move alone.
 * No lint rule can see what a colour is for, so this pins where the token may appear: a new use
 * fails until it is added here as a hover or highlight fill, or takes its job's own name.
 *
 * A source scan over the app, Storybook's preview (which repeats AppLayout's SkeletonTheme) and
 * inkweave-ui. Tests and stories are left out: they assert or show the token, they don't paint with it.
 */

const REPO = resolve(__dirname, '../../../../../..');
const ROOTS = ['apps/web/src', 'apps/web/.storybook', 'packages/ui/src'];

/** Each file that paints with surfaceHover, and how many times: all hover or highlight fills. */
const HOVER_SITES: Record<string, number> = {
  'apps/web/src/features/collection/FriendsWhoHaveIt.tsx': 1, // a friend row under the pointer
  'apps/web/src/shared/components/CompactHeader.tsx': 1, // the nav's current page
  'apps/web/src/shared/components/SearchAutocomplete.tsx': 1, // the highlighted option
  'apps/web/src/shared/components/SearchBottomSheet.tsx': 1, // the highlighted option
  'packages/ui/src/components/IconButton.tsx': 1, // an icon button under the pointer
};

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    const isSource = /\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name);
    return isSource ? [full] : [];
  });
}

/** Every file that names COLORS.surfaceHover, with its count, the token's own file aside. */
function surfaceHoverUses(): Record<string, number> {
  const uses: Record<string, number> = {};
  for (const file of ROOTS.flatMap((root) => sourceFiles(join(REPO, root)))) {
    const count = readFileSync(file, 'utf8').match(/COLORS\.surfaceHover\b/g)?.length ?? 0;
    if (count > 0) uses[relative(REPO, file).replace(/\\/g, '/')] = count;
  }
  return uses;
}

describe("surfaceHover's jobs", () => {
  it('paints only hover and highlight fills; a fill, a line or a skeleton takes its own name', () => {
    expect(surfaceHoverUses()).toEqual(HOVER_SITES);
  });

  it('names its other jobs in the same colour, so moving onto them changed nothing on screen', () => {
    // When a job's colour moves on purpose, its line here moves with it.
    expect(COLORS.neutralFill).toBe(COLORS.surfaceHover);
    expect(COLORS.subtleBorder).toBe(COLORS.surfaceHover);
    expect(COLORS.skeletonHighlight).toBe(COLORS.surfaceHover);
  });
});
