import {describe, expect, it} from 'vitest';
import {toastConstant, versionsOf} from './check-sw-update.mjs';

const INDEX = '<!doctype html><html><head><title>Inkweave</title></head><body></body></html>';
const SW =
  'define(["./workbox-e006fe99"],function(s){s.precacheAndRoute([{url:"index.html",revision:"b46831dc654787d79fcacf362146b5b4"},' +
  '{url:"assets/index-DyMLC-Ad.js",revision:null}],{})});';

describe('versionsOf', () => {
  it("gives the new deploy's sw.js another index.html revision, and nothing else", () => {
    const {old: before, new: after} = versionsOf(INDEX, SW);
    expect(before.sw).toBe(SW);
    expect(after.sw).not.toBe(SW);
    expect(after.sw.replace(/revision:"[0-9a-f]{32}"/, '')).toBe(
      SW.replace(/revision:"[0-9a-f]{32}"/, ''),
    );
  });

  it('names each version in its index.html', () => {
    const {old: before, new: after} = versionsOf(INDEX, SW);
    expect(before.index).toContain('<meta name="sw-check-version" content="old">');
    expect(after.index).toContain('<meta name="sw-check-version" content="new">');
  });

  it('says why when sw.js precaches no index.html', () => {
    expect(() => versionsOf(INDEX, 'self.addEventListener("fetch", () => {});')).toThrow(
      /precaches no index\.html/,
    );
  });
});

describe('toastConstant', () => {
  it('reads a number however it is written', () => {
    const name = 'UPDATE_TOAST_MAX_MS';
    expect(toastConstant('export const UPDATE_TOAST_MAX_MS = 10000;', name)).toBe(10000);
    expect(toastConstant('export const UPDATE_TOAST_MAX_MS = 10_000;', name)).toBe(10000);
    expect(toastConstant('export const UPDATE_TOAST_MAX_MS: number = 10000;', name)).toBe(10000);
  });

  it('says which number it could not find', () => {
    expect(() =>
      toastConstant('export const UPDATE_TOAST_MAX_MS = 10000;', 'UPDATE_TOAST_LEAD_MS'),
    ).toThrow(/UPDATE_TOAST_LEAD_MS not found/);
  });
});
