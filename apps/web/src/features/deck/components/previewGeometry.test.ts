import {describe, expect, it} from 'vitest';
import {previewGeometry} from './previewGeometry';

const anchor = (left: number) => ({left, top: 300, height: 56});

describe('previewGeometry', () => {
  it('sizes the preview to the full card width when there is room', () => {
    expect(previewGeometry(anchor(1600), 1200)?.width).toBe(340);
  });

  it('never overlaps the row it is anchored to, however narrow the gap', () => {
    // A ~768px-wide window: the 500px-min deck pane leaves too little room for 340px.
    const geo = previewGeometry(anchor(324), 900);
    expect(geo).not.toBeNull();
    expect(geo!.left).toBeGreaterThanOrEqual(12); // clear of the viewport's left edge
    expect(geo!.left + geo!.width).toBeLessThanOrEqual(324); // clear of the anchor
  });

  it('never overflows a short viewport', () => {
    const viewportHeight = 400; // e.g. devtools docked along the bottom
    const geo = previewGeometry(anchor(1600), viewportHeight);
    expect(geo).not.toBeNull();
    expect(geo!.top).toBeGreaterThanOrEqual(12);
    expect(geo!.top + geo!.height).toBeLessThanOrEqual(viewportHeight - 12);
  });

  it('renders nothing rather than an unreadable sliver when the gap is tiny', () => {
    expect(previewGeometry(anchor(100), 900)).toBeNull();
  });
});
