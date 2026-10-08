import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {scripts} = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const steps = scripts['build:vercel'].split('&&').map((step) => step.trim());
const stepIndex = (script) => steps.findIndex((step) => step.includes(script));

// #750: card-images-raw/ is git-ignored, so a deploy checkout holds a raw only when admin just
// committed it, and that raw is newer than any AVIF already there. Without --force the build kept
// the old AVIF and shipped the old art, while Convert reveal images committed the new one as
// [skip ci], which deploys nothing.
describe('build:vercel', () => {
  it('re-converts every raw in the checkout, even over an existing AVIF', () => {
    const convert = steps[stepIndex('scripts/convert-preview-images.mjs')];
    expect(convert?.split(/\s+/)).toContain('--force');
  });

  it('converts the raws before download-card-images copies the preview AVIFs', () => {
    const convert = stepIndex('scripts/convert-preview-images.mjs');
    expect(convert).toBeGreaterThan(-1);
    expect(convert).toBeLessThan(stepIndex('scripts/download-card-images.mjs'));
  });
});
