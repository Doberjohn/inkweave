import type {CSSProperties} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {smallImageUrl} from '../../cards/loader';
import {COLORS, whiteRgba} from '../../../shared/constants';

/** The medal's rim: a dark hairline, then a faint light one, so the art reads on any surface. */
const RIM = `0 0 0 1.5px ${COLORS.background}, 0 0 0 2.5px ${whiteRgba(0.14)}`;

const medalStyle = (size: number): CSSProperties => ({
  display: 'inline-block',
  width: size,
  height: size,
  borderRadius: '50%',
  overflow: 'hidden',
  flexShrink: 0,
  boxShadow: RIM,
  background: COLORS.neutralFill,
});

/** The art, cropped to the character: the top of the card, where the face sits. */
const ART_STYLE: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '160%',
  objectFit: 'cover',
  objectPosition: '50% 18%',
};

/**
 * A binder's medal: a round crop of its cover card's small art, as the set picker shows
 * it beside the binder's name, or an empty ring while the binder holds none of your cards.
 * Decoration: the name beside it says which binder.
 */
export function BinderMedal({card, size}: {card: LorcanaCard | null; size: number}) {
  const art = card === null ? undefined : smallImageUrl(card);
  return (
    <span aria-hidden="true" data-testid="binder-medal" style={medalStyle(size)}>
      {art !== undefined && <img src={art} alt="" decoding="async" style={ART_STYLE} />}
    </span>
  );
}
