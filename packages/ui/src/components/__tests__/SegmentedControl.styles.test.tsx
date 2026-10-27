import {readFileSync} from 'node:fs';
import path from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {render} from '@testing-library/react';
import {COLORS, DISABLED_STYLE, GOLD_GLOW, NEUTRAL_LADDER, SPACING} from '../../tokens/theme';
import {SegmentedControl} from '../SegmentedControl';

// jsdom resolves no var(), and Vitest loads no stylesheet a module imports, so these tests read
// SegmentedControl.css's own rules from the CSSOM and resolve each var() against the custom
// properties the rendered group sets (SEGMENTED_LOOK). Read at module scope (tests.md).
const CSS = readFileSync(path.join(import.meta.dirname, '../SegmentedControl.css'), 'utf8');
// Open-ended, so a var() with a fallback counts as used too.
const USED = new Set([...CSS.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name));

const OPTIONS = ['A', 'B', 'C'].map((label) => ({value: label, label}));

let sheet: HTMLStyleElement;
beforeAll(() => {
  sheet = document.createElement('style');
  sheet.textContent = CSS;
  document.head.append(sheet);
});
afterAll(() => sheet.remove());

/** The style rule for a selector, inside the media query given, or at the top level. */
function ruleFor(selector: string, media?: string): CSSStyleRule {
  const top = [...sheet.sheet!.cssRules];
  const scope = media
    ? top.flatMap((r) =>
        r instanceof CSSMediaRule && r.media.mediaText === media ? [...r.cssRules] : [],
      )
    : top;
  const rule = scope.find(
    (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText === selector,
  );
  if (!rule)
    throw new Error(`SegmentedControl.css has no ${selector}${media ? ` in @media ${media}` : ''}`);
  return rule;
}

function renderControl({fill = false, held = false} = {}) {
  const {container} = render(
    <SegmentedControl
      options={OPTIONS}
      value="A"
      onChange={() => {}}
      ariaLabel="Pick"
      fill={fill}
      held={held}
    />,
  );
  const group = container.querySelector<HTMLElement>('.segmented')!;
  /** A declaration as the browser would read it here: each var() is the group's value. */
  const value = (rule: CSSStyleRule, property: string) =>
    rule.style
      .getPropertyValue(property)
      .replace(/var\((--[\w-]+)\)/g, (_, name: string) => group.style.getPropertyValue(name));
  return {group, buttons: [...group.querySelectorAll<HTMLElement>('.segmented-btn')], value};
}

describe('SegmentedControl.css', () => {
  it('draws with every custom property the group sets, and sets every one it draws with', () => {
    const {group} = renderControl();
    const set = [...group.style].filter((name) => name.startsWith('--'));
    expect(new Set(set)).toEqual(USED);
  });

  it('draws the track from the group: padded by the gap, its fill clipped inside its 1px border', () => {
    const {value} = renderControl();
    const track = ruleFor('.segmented');
    expect(value(track, 'padding')).toBe(`${SPACING.xxs}px`);
    expect(value(track, 'gap')).toBe(`${SPACING.xxs}px`);
    expect(value(track, 'border')).toBe(`1px solid ${NEUTRAL_LADDER.border}`);
    expect(track.style.getPropertyValue('background-clip')).toBe('padding-box');
    // The shorthand would reset the clip, so the fill is set alone.
    expect(track.style.getPropertyValue('background')).toBe('');
  });

  it('marks the pressed option in the accent, ringed by the strong gold, and rings focus in the accent', () => {
    const {buttons, value} = renderControl();
    const pressed = ruleFor(".segmented-btn[aria-pressed='true']");
    expect(buttons.filter((b) => b.matches(pressed.selectorText))).toEqual([buttons[0]]);
    expect(value(pressed, 'color')).toBe(COLORS.primary);
    expect(value(pressed, 'box-shadow')).toBe(`inset 0 0 0 1px ${GOLD_GLOW.strongBorder}`);
    expect(value(ruleFor('.segmented-btn:focus-visible'), 'outline')).toBe(
      `2px solid ${COLORS.primary}`,
    );
  });

  it('dims a held option as a disabled control, and gives it no hover', () => {
    const live = renderControl();
    const held = renderControl({held: true});
    const dim = ruleFor(".segmented-btn[aria-disabled='true']");
    expect(held.buttons.every((b) => b.matches(dim.selectorText))).toBe(true);
    expect(held.value(dim, 'opacity')).toBe(String(DISABLED_STYLE.opacity));
    expect(dim.style.getPropertyValue('cursor')).toBe('not-allowed');
    // A touch screen takes no hover either, so the rule lives under (hover: hover).
    const hover = ruleFor(
      ".segmented-btn:hover:where(:not([aria-disabled='true']))",
      '(hover: hover)',
    );
    const unhovered = hover.selectorText.replace(':hover', '');
    expect(live.buttons.every((b) => b.matches(unhovered))).toBe(true);
    expect(held.buttons.some((b) => b.matches(unhovered))).toBe(false);
  });

  it('shares a filling row by button count, two to a pair, an odd count’s lone last one taking one share', () => {
    const {group, value} = renderControl({fill: true});
    expect(group.matches(ruleFor(".segmented[data-fill='true']").selectorText)).toBe(true);
    expect(value(ruleFor(".segmented[data-fill='true']"), 'flex-wrap')).toBe('wrap');
    expect(value(ruleFor('.segmented-pair'), 'flex')).toBe(`2 1 ${SPACING.xxs}px`);
    const lone = ruleFor(".segmented-pair[data-lone='true']");
    expect(
      [...group.querySelectorAll('.segmented-pair')].map((p) => p.matches(lone.selectorText)),
    ).toEqual([false, true]);
    expect(value(lone, 'flex')).toBe('1 1 0px');
    const inPair = ruleFor('.segmented-pair > .segmented-btn');
    expect(value(inPair, 'flex')).toBe('1 1 0px');
    expect(value(inPair, 'padding')).toBe(`0 ${SPACING.xs}px`);
  });

  it('stops its transition for reduced motion', () => {
    expect(
      ruleFor('.segmented-btn', '(prefers-reduced-motion: reduce)').style.getPropertyValue(
        'transition',
      ),
    ).toBe('none');
  });
});
