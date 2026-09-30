import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSeason} from '../season.mjs';

const REVEAL_SET = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/web/src/shared/constants/revealSet.ts',
);

describe('loadSeason', () => {
  it("reads the reveal season's set code and id base from revealSet.ts", async () => {
    // Read as text, so the expectation can't share a bug with the loader.
    const [, setCode] = fs.readFileSync(REVEAL_SET, 'utf8').match(/REVEAL_SET_CODE = '([^']+)'/);
    const season = await loadSeason();
    expect(season.setCode).toBe(setCode);
    expect(season.idBase).toBeGreaterThan(0);
    expect(season.idBase % 1000).toBe(0);
  }, 60_000);
});
