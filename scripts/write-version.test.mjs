import {describe, it, expect, vi} from 'vitest';
import {resolveBuildSha} from './write-version.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);

describe('resolveBuildSha', () => {
  it('takes GITHUB_SHA first, without asking git', () => {
    // Production builds run in GitHub Actions, where GITHUB_SHA is the pushed commit.
    const gitHead = vi.fn(() => C);
    expect(resolveBuildSha({GITHUB_SHA: A, VERCEL_GIT_COMMIT_SHA: B}, gitHead)).toEqual({
      sha: A,
      source: 'GITHUB_SHA',
    });
    expect(gitHead).not.toHaveBeenCalled();
  });

  it("falls back to VERCEL_GIT_COMMIT_SHA on Vercel's own builds", () => {
    expect(resolveBuildSha({GITHUB_SHA: '', VERCEL_GIT_COMMIT_SHA: B}, () => C)).toEqual({
      sha: B,
      source: 'VERCEL_GIT_COMMIT_SHA',
    });
  });

  it('falls back to git when neither variable is set, trimming its newline', () => {
    expect(resolveBuildSha({}, () => `${C}\n`)).toEqual({sha: C, source: 'git rev-parse HEAD'});
  });

  it('skips a value that is not a full sha, with a warning, and tries the next source', () => {
    const warn = vi.fn();
    expect(
      resolveBuildSha({GITHUB_SHA: 'abc123', VERCEL_GIT_COMMIT_SHA: B}, () => C, warn),
    ).toEqual({
      sha: B,
      source: 'VERCEL_GIT_COMMIT_SHA',
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('GITHUB_SHA'));
  });

  it('returns null when no source answers, so the build writes no stamp instead of failing', () => {
    expect(resolveBuildSha({}, () => undefined)).toBeNull();
  });
});
