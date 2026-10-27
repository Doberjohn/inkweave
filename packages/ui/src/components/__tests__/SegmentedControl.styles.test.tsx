import {readFileSync} from 'node:fs';
import path from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {render} from '@testing-library/react';
import {
  COLORS,
  DISABLED_STYLE,
  FONT_SIZES,
  GOLD_GLOW,
  NEUTRAL_LADDER,
  RADIUS,
  SPACING,
} from '../../tokens/theme';
import {SegmentedControl} from '../SegmentedControl';

// jsdom resolves no var(), and Vitest loads no stylesheet a module imports, so these tests read
// SegmentedControl.css's own rules from the CSSOM and resolve each var() against the custom
// properties the rendered group sets (SEGMENTED_LOOK). Read at module scope (tests.md).
const CSS = readFileSync(path.join(import.meta.dirname, '../SegmentedControl.css'), 'utf8');
// Comments aside, and open-ended, so a var() with a fallback counts as used too.
const USED = new Set(
  [...CSS.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name),
);
/** A var() and its fallback, if it has one. */
const VAR = /var\((--[\w-]+)(?:,\s*([^)]*))?\)/g;

const OPTIONS = ['A', 'B', 'C'].map((label) => ({value: label, label}));
const PRESSED = ".segmented-btn[aria-pressed='true']";
const HOVER = ".segmented-btn:hover:where(:not([aria-disabled='true']))";

let sheet: HTMLStyleElement;
beforeAll(() => {
  sheet = document.createElement('style');
  sheet.textContent = CSS;
  document.head.append(sheet);
});
afterAll(() => sheet.remove());

/** Quotes and spaces aside, so a reformatted sheet or a CSSOM that writes it otherwise matches. */
const bare = (text: string) => text.replace(/["'\s]/g, '');

/** Every style rule in the sheet, those inside media queries too. */
const styleRules = () =>
  [...sheet.sheet!.cssRules]
    .flatMap((r) => (r instanceof CSSMediaRule ? [...r.cssRules] : [r]))
    .filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);

/** The style rule for a selector, inside the media query given, or at the top level. */
function ruleFor(selector: string, media?: string): CSSStyleRule {
  const top = [...sheet.sheet!.cssRules];
  const scope = media
    ? top.flatMap((r) =>
        r instanceof CSSMediaRule && bare(r.media.mediaText) === bare(media) ? [...r.cssRules] : [],
      )
    : top;
  const rule = scope.find(
    (r): r is CSSStyleRule => r instanceof CSSStyleRule && bare(r.selectorText) === bare(selector),
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
  /** A declaration as a browser reads it here: each var() is the group's value, or its fallback. */
  const value = (rule: CSSStyleRule, property: string) =>
    rule.style
      .getPropertyValue(property)
      .replace(
        VAR,
        (_, name: string, fallback?: string) =>
          group.style.getPropertyValue(name) || fallback || '',
      );
  return {group, buttons: [...group.querySelectorAll<HTMLElement>('.segmented-btn')], value};
}

describe('SegmentedControl.css', () => {
  it('draws with every custom property the group sets, and sets every one it draws with', () => {
    const {group} = renderControl();
    const set = [...group.style].filter((name) => name.startsWith('--'));
    expect(new Set(set)).toEqual(USED);
  });

  it('draws the track from the group: padded by the gap, its fill clipped inside its 1px border', () => {
    const {group, value} = renderControl({fill: true});
    const track = ruleFor('.segmented');
    expect(value(track, 'padding')).toBe(`${SPACING.xxs}px`);
    expect(value(track, 'gap')).toBe(`${SPACING.xxs}px`);
    expect(value(track, 'border')).toBe(`1px solid ${NEUTRAL_LADDER.border}`);
    expect(value(track, 'border-radius')).toBe(`${RADIUS.md}px`);
    expect(value(track, 'background-color')).toBe(NEUTRAL_LADDER.card);
    expect(track.style.getPropertyValue('background-clip')).toBe('padding-box');
    // The shorthand would reset the clip, so no rule on the group sets it.
    const onGroup = styleRules().filter((r) => group.matches(r.selectorText));
    expect(onGroup.filter((r) => r.style.getPropertyValue('background') !== '')).toEqual([]);
  });

  it('draws an option muted, pressed in the accent ringed by the strong gold, and focused in an accent ring', () => {
    const {buttons, value} = renderControl();
    const option = ruleFor('.segmented-btn');
    // Admin's control height, which its filter rows line up with.
    expect(value(option, 'min-height')).toBe('32px');
    expect(value(option, 'padding')).toBe(`0 ${SPACING.md}px`);
    expect(value(option, 'border-radius')).toBe(`${RADIUS.md}px`);
    expect(value(option, 'color')).toBe(COLORS.textMuted);
    expect(value(option, 'font-size')).toBe(`${FONT_SIZES.md}px`);
    const pressed = ruleFor(PRESSED);
    expect(buttons.filter((b) => b.matches(pressed.selectorText))).toEqual([buttons[0]]);
    expect(value(pressed, 'background')).toBe(NEUTRAL_LADDER.navHover);
    expect(value(pressed, 'color')).toBe(COLORS.primary);
    expect(value(pressed, 'box-shadow')).toBe(`inset 0 0 0 1px ${GOLD_GLOW.strongBorder}`);
    expect(value(ruleFor('.segmented-btn:focus-visible'), 'outline')).toBe(
      `2px solid ${COLORS.primary}`,
    );
  });

  it('lights a live option on hover, and dims a held one as a disabled control, with no hover', () => {
    const live = renderControl();
    const held = renderControl({held: true});
    // A touch screen takes no hover either, so the rule lives under (hover: hover).
    const hover = ruleFor(HOVER, '(hover: hover)');
    expect(live.value(hover, 'background')).toBe(NEUTRAL_LADDER.navHover);
    expect(live.value(hover, 'color')).toBe(COLORS.text);
    const unhovered = hover.selectorText.replace(':hover', '');
    expect(live.buttons.every((b) => b.matches(unhovered))).toBe(true);
    expect(held.buttons.some((b) => b.matches(unhovered))).toBe(false);
    const dim = ruleFor(".segmented-btn[aria-disabled='true']");
    expect(held.buttons.every((b) => b.matches(dim.selectorText))).toBe(true);
    expect(held.value(dim, 'opacity')).toBe(String(DISABLED_STYLE.opacity));
    expect(dim.style.getPropertyValue('cursor')).toBe('not-allowed');
  });

  it('shares a filling row by button count, two to a pair, an odd count’s lone last one taking one share', () => {
    const {group, value} = renderControl({fill: true});
    const filled = ruleFor(".segmented[data-fill='true']");
    expect(group.matches(filled.selectorText)).toBe(true);
    expect(value(filled, 'flex-wrap')).toBe('wrap');
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

  it('keeps each rule that wins a specificity tie later in the sheet than the rule it beats', () => {
    // A hovered pressed option keeps the accent, and reduced motion stops the transition, only
    // because each rule comes after the one it ties with.
    const at = (rule: CSSStyleRule) => [...sheet.sheet!.cssRules].indexOf(rule.parentRule ?? rule);
    expect(at(ruleFor(PRESSED))).toBeGreaterThan(at(ruleFor(HOVER, '(hover: hover)')));
    expect(at(ruleFor('.segmented-btn', '(prefers-reduced-motion: reduce)'))).toBeGreaterThan(
      at(ruleFor('.segmented-btn')),
    );
  });
});
