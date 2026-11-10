import {describe, expect, it} from 'vitest';
import {COVER_DESIGNS, DESIGN_ID, coverDesign} from './coverDesigns';

describe('the cover designs', () => {
  it('are eight, each with an id of its own that the column takes', () => {
    const ids = COVER_DESIGNS.map((design) => design.id);
    expect(ids).toEqual(['starry-night', 'sunburst', 'tartan', 'pinstripe', 'scales', 'argyle', 'honeycomb', 'ripples']);
    expect(new Set(ids).size).toBe(8);
    for (const id of ids) expect(id).toMatch(DESIGN_ID);
  });

  it('take the shape the column checks, and refuse what it refuses', () => {
    for (const refused of ['Starry Night', 'starry night', '', '-tartan', '9lives', 'a'.repeat(25)]) {
      expect(refused).not.toMatch(DESIGN_ID);
    }
    expect('a'.repeat(24)).toMatch(DESIGN_ID);
  });

  it("draw a row's cover by its id, and Starry night for none or an id this build doesn't know", () => {
    expect(coverDesign('tartan').label).toBe('Tartan');
    expect(coverDesign(null).label).toBe('Starry night');
    expect(coverDesign('gone').label).toBe('Starry night');
  });
});
