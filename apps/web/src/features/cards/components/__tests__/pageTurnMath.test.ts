import {describe, it, expect} from 'vitest';
import {flickSpeed, glideMs, grabProgress, landsOnRelease, shadeAt, turnPlan, type Grip} from '../pageTurnMath';

const SPREAD = {single: false, perPage: 12};
const PHONE = {single: true, perPage: 12};

describe('turnPlan', () => {
  it('lifts the right page off the front cover spread and lands it as the next left page', () => {
    // The binder already shows spread 2, so the front cover lies flat over its left page.
    expect(turnPlan(-12, 12, {...SPREAD, held: false})).toEqual({
      lifts: 'right',
      front: {from: 0, side: 'right'},
      back: {from: 12, side: 'left'},
      flat: {from: -12, side: 'left'},
      startAngle: 0,
      endAngle: -180,
    });
    // Held, the binder still shows the first spread, and the sheet uncovers spread 2's right page.
    expect(turnPlan(-12, 12, {...SPREAD, held: true}).flat).toEqual({from: 24, side: 'right'});
  });

  it('lifts the left page going back and lands it as the right page before', () => {
    expect(turnPlan(36, 12, {...SPREAD, held: false})).toEqual({
      lifts: 'left',
      front: {from: 36, side: 'left'},
      back: {from: 24, side: 'right'},
      flat: {from: 48, side: 'right'},
      startAngle: 0,
      endAngle: 180,
    });
    expect(turnPlan(36, 12, {...SPREAD, held: true}).flat).toEqual({from: 12, side: 'left'});
  });

  it("swings a phone's page away going forward, over the next page once it is held", () => {
    expect(turnPlan(0, 12, {...PHONE, held: false})).toEqual({
      lifts: 'right',
      front: {from: 0, side: 'right'},
      startAngle: 0,
      endAngle: -100,
    });
    expect(turnPlan(0, 12, {...PHONE, held: true}).flat).toEqual({from: 12, side: 'right'});
  });

  it("swings a phone's page before back in, over the page it covers until the binder shows it", () => {
    expect(turnPlan(24, 12, {...PHONE, held: false})).toEqual({
      lifts: 'right',
      front: {from: 12, side: 'right'},
      flat: {from: 24, side: 'right'},
      startAngle: -100,
      endAngle: 0,
    });
    expect(turnPlan(24, 12, {...PHONE, held: true}).flat).toBeUndefined();
  });

  it('turns one sheet for a jump of several views', () => {
    expect(turnPlan(12, 108, {...SPREAD, held: false})).toMatchObject({
      front: {from: 24, side: 'right'},
      back: {from: 108, side: 'left'},
      flat: {from: 12, side: 'left'},
    });
  });
});

describe('grabProgress', () => {
  // A right page 300px wide beside the spine at x 100, held a third of the way across.
  const grip: Grip = {x0: 200, pivot: 100, width: 300, dir: 1, single: false};

  it('keeps the spot held under the pointer: flat where it was taken, on edge over the spine, landed past it', () => {
    expect(grabProgress(200, grip)).toBe(0);
    expect(grabProgress(100, grip)).toBeCloseTo(0.5);
    expect(grabProgress(0, grip)).toBe(1);
    expect(grabProgress(-200, grip)).toBe(1);
  });

  it("swings a phone's page 100 degrees, so it is 0.9 over by the spine", () => {
    expect(grabProgress(100, {...grip, single: true})).toBeCloseTo(0.9);
  });

  it("follows a finger swiping a phone's page before back in, landed at 85% of the page across", () => {
    const back: Grip = {...grip, dir: -1, single: true};
    expect(grabProgress(200, back)).toBe(0);
    expect(grabProgress(200 + 0.85 * 300, back)).toBeCloseTo(1);
  });
});

describe('the release', () => {
  it('reads the speed over the last 80 ms, none after a pause or from one sample', () => {
    const steady = Array.from({length: 8}, (_, i) => [i * 16, i * 16] as const);
    expect(flickSpeed(steady)).toBe(1);
    expect(flickSpeed([...steady, [212, 112]])).toBe(0);
    expect(flickSpeed([[5, 40]])).toBe(0);
  });

  it('lands past halfway or on a flick its way, and otherwise falls back', () => {
    expect(landsOnRelease(0.51, 0)).toBe(true);
    expect(landsOnRelease(0.3, 0.6)).toBe(true);
    expect(landsOnRelease(0.03, 2)).toBe(false);
    expect(landsOnRelease(0.3, 0.4)).toBe(false);
  });

  it('glides the rest of the way in time for the distance left', () => {
    expect(glideMs(0, true)).toBe(560);
    expect(glideMs(1, false)).toBe(460);
  });

  it('shades the sheet none flat and darkest on edge', () => {
    expect(shadeAt(0)).toBe(0);
    expect(shadeAt(0.5)).toBe(0.75);
  });
});
