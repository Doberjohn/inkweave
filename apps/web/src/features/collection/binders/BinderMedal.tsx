import type {CSSProperties} from 'react';
import {COLORS, whiteRgba} from '../../../shared/constants';
import type {CoverDesign} from './coverDesigns';

/** The medal's rim: a dark hairline, then a faint light one, so the pattern reads on any surface. */
const RIM = `0 0 0 1.5px ${COLORS.background}, 0 0 0 2.5px ${whiteRgba(0.14)}`;

const medalStyle = (size: number, design: CoverDesign | null): CSSProperties => ({
  display: 'inline-block',
  width: size,
  height: size,
  borderRadius: '50%',
  overflow: 'hidden',
  flexShrink: 0,
  boxShadow: RIM,
  background: design?.ground ?? COLORS.neutralFill,
});

/**
 * A binder's medal: a round crop of its cover's pattern, as the set picker and the Binders tab
 * show it beside the binder's name, or an empty ring while My collection's cover is still to be
 * read. Decoration: the name beside it says which binder.
 */
export function BinderMedal({design, size}: {design: CoverDesign | null; size: number}) {
  return <span aria-hidden="true" data-testid="binder-medal" data-cover={design?.id} style={medalStyle(size, design)} />;
}
