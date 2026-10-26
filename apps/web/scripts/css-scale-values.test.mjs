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
    const css = '.a { border-radius: 0; box-shadow: none; border-radius: 50%; font-size: var(--size); transition: var(--fade); }';
    expect(countScaleValues(css)).toBe(0);
  });

  it("leaves out a decorative infinite animation's timings, and counts a finite one", () => {
    expect(countScaleValues('.a { animation: spin 2s linear infinite; } .b { animation: pop 450ms both; }')).toBe(1);
  });

  it("reads a shadow's geometry, not the numbers in its colours or a variable's name", () => {
    const css = '.a { text-shadow: 0 0 rgba(0, 0, 0, 0.5); box-shadow: 0 0 0 var(--glow-2); } .b { box-shadow: 0 1px #00000080; }';
    expect(countScaleValues(css)).toBe(1);
  });

  it('reads declarations in keyframes and media blocks, and never in comments', () => {
    const css = `/* box-shadow: 0 8px 24px black; */
@keyframes breathe { 0%, 100% { box-shadow: 0 0 12px var(--low); } 50% { box-shadow: 0 0 26px var(--high); } }
@media (prefers-reduced-motion: reduce) { .a { transition-duration: 0.01ms; } }`;
    expect(countScaleValues(css)).toBe(3);
  });
});
