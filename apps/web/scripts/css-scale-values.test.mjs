// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {countScaleValues} from './css-scale-values.mjs';

describe('countScaleValues', () => {
  it('counts a radius, a font size, a shadow and a duration', () => {
    const css = `.a { border-top-left-radius: 18px; font-size: 1.125rem; box-shadow: 0 2px 4px var(--drop); transition: opacity 0.2s ease; }`;
    expect(countScaleValues(css)).toBe(4);
  });

  it('counts a declaration once, however many values it types in', () => {
    expect(countScaleValues('.a { transition: opacity 200ms, transform 0.3s; border-radius: 2px 4px 4px 2px; }')).toBe(2);
  });

  it('leaves out zero, keywords, percentages and variables', () => {
    const css = '.a { border-radius: 0; box-shadow: none; border-radius: 50%; font-size: var(--size); transition: var(--fade); transition-delay: 0s; }';
    expect(countScaleValues(css)).toBe(0);
  });

  it('leaves out unitless numbers: a calc() factor and the digits in a name', () => {
    const css = '.a { font-size: calc(var(--fs-base) * 1.25); border-radius: calc(var(--radius) / 2); box-shadow: 0 0 0 var(--elev-2-1); }';
    expect(countScaleValues(css)).toBe(0);
  });

  it("leaves out an infinite animation's timings and a negative delay, and counts a finite animation beside an infinite one", () => {
    const css = `.a { animation: spin 2s linear infinite; } .b { animation-delay: -1.8s; } .c { animation: fade 300ms ease, pulse 2s infinite; } .d { animation: infinite-scroll 400ms ease; }`;
    expect(countScaleValues(css)).toBe(2);
  });

  it("reads a shadow's geometry, not the numbers in its colours", () => {
    const css = '.a { text-shadow: 0 0 rgba(0, 0, 0, 0.5); box-shadow: var(--geom) rgba(var(--accent-rgb), 0.4); } .b { box-shadow: 0 1px #00000080; }';
    expect(countScaleValues(css)).toBe(1);
  });

  it("reads a filter's drop-shadow(), and no other filter", () => {
    const css = '.a { filter: drop-shadow(0 1px 4px color-mix(in srgb, var(--ink) 80%, transparent)); } .b { filter: drop-shadow(0 0 0 transparent) blur(4px); }';
    expect(countScaleValues(css)).toBe(1);
  });

  it('reads the font shorthand and vendor-prefixed properties', () => {
    expect(countScaleValues('.a { font: 600 14px/1.2 sans-serif; -webkit-box-shadow: 0 2px 4px black; }')).toBe(2);
  });

  it('counts a custom property a scale property in the stylesheet reads, and no other', () => {
    const css = '.a { --glow: 0 0 22px 3px var(--soft); --card-w: 200px; width: var(--card-w); } .a:hover { box-shadow: var(--glow); }';
    expect(countScaleValues(css)).toBe(1);
  });

  it('reads declarations in keyframes and media blocks, and never in comments', () => {
    const css = `/* box-shadow: 0 8px 24px black; */
@keyframes breathe { 0%, 100% { box-shadow: 0 0 12px var(--low); } 50% { box-shadow: 0 0 26px var(--high); } }
@media (prefers-reduced-motion: reduce) { .a { transition-duration: 0.01ms; } }`;
    expect(countScaleValues(css)).toBe(3);
  });
});
