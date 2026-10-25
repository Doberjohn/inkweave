import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {linkShippedBrowsers, wantedBrowsers} from '../playwright-browsers.mjs';

const WANTED = [
  {dir: 'chromium', revision: '1248'},
  {dir: 'chromium_headless_shell', revision: '1248'},
  {dir: 'ffmpeg', revision: '1013'},
];

let root;
let shippedDir;
let linkDir;

function ship(...folders) {
  for (const folder of folders) mkdirSync(join(shippedDir, folder), {recursive: true});
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'pw-browsers-'));
  shippedDir = join(root, 'shipped');
  linkDir = join(root, 'links');
  mkdirSync(shippedDir);
});

afterEach(() => {
  rmSync(root, {recursive: true, force: true});
});

describe('wantedBrowsers', () => {
  it("lists the chromium projects' browsers under their folder names", () => {
    const browsersJson = {
      browsers: [
        {name: 'chromium', revision: '1248'},
        {name: 'chromium-headless-shell', revision: '1248'},
        {name: 'webkit', revision: '2370'},
        {name: 'ffmpeg', revision: '1013'},
      ],
    };
    expect(wantedBrowsers(browsersJson)).toEqual(WANTED);
  });
});

describe('linkShippedBrowsers', () => {
  it('uses the shipped folder and writes nothing when every wanted build is there', () => {
    ship('chromium-1248', 'chromium_headless_shell-1248', 'ffmpeg-1013');
    const result = linkShippedBrowsers({shippedDir, linkDir, wanted: WANTED});
    expect(result).toEqual({browsersPath: shippedDir, linked: []});
    expect(readdirSync(root)).toEqual(['shipped']);
  });

  it('links each missing build to the newest shipped one, and the rest to themselves', () => {
    ship('chromium-1194', 'chromium-1243', 'chromium_headless_shell-1243', 'ffmpeg-1013');
    const result = linkShippedBrowsers({shippedDir, linkDir, wanted: WANTED});
    expect(result).toEqual({
      browsersPath: linkDir,
      linked: [
        'chromium-1248 -> chromium-1243',
        'chromium_headless_shell-1248 -> chromium_headless_shell-1243',
      ],
    });
    expect(realpathSync(join(linkDir, 'chromium-1248'))).toBe(
      realpathSync(join(shippedDir, 'chromium-1243')),
    );
    expect(realpathSync(join(linkDir, 'ffmpeg-1013'))).toBe(
      realpathSync(join(shippedDir, 'ffmpeg-1013')),
    );
  });

  it('replaces the links a previous run left', () => {
    ship('chromium-1243', 'chromium_headless_shell-1243', 'ffmpeg-1011');
    linkShippedBrowsers({shippedDir, linkDir, wanted: WANTED});
    ship('chromium-1244');
    linkShippedBrowsers({shippedDir, linkDir, wanted: WANTED});
    expect(realpathSync(join(linkDir, 'chromium-1248'))).toBe(
      realpathSync(join(shippedDir, 'chromium-1244')),
    );
  });

  it('names the browsers folder when it is missing', () => {
    expect(() =>
      linkShippedBrowsers({shippedDir: join(root, 'absent'), linkDir, wanted: WANTED}),
    ).toThrow(/No browsers folder at .*absent/);
  });

  it('names the browser the container has no build of', () => {
    ship('chromium-1243', 'ffmpeg-1011');
    expect(() => linkShippedBrowsers({shippedDir, linkDir, wanted: WANTED})).toThrow(
      /No chromium_headless_shell build/,
    );
  });
});
