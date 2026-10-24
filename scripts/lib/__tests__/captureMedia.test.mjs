import {describe, it, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CAPTURE_MEDIA} from '../captureMedia.mjs';

const INDEX_HTML = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../apps/web/index.html',
);

describe('CAPTURE_MEDIA', () => {
  it('names the screens index.html keeps an unapproved #root off and swaps the phone capture in on', () => {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    expect(html).toContain(`@media ${CAPTURE_MEDIA.phone} {`);
    expect(html).toContain(`matchMedia('${CAPTURE_MEDIA.phone}')`);
  });
});
