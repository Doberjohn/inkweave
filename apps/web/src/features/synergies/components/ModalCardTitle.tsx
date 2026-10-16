import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SET_LOGOS, SET_NAMES, SPACING, type SetCode} from '../../../shared/constants';
import {pickModalTitleStyle} from './cardOverviewModalStyles';

interface ModalCardTitleProps {
  card: LorcanaCard;
  isMobile: boolean;
  /** `h1` in the modal; the loading fallback, a status region, uses a `div`. */
  as?: 'h1' | 'div';
}

/**
 * The logo's height, which also sets the desktop header's (the title's line and the close
 * button are shorter). Every card shows one, so the header keeps one height while paging; in
 * a comparison BACK takes the title's place and keeps this height too (CardOverviewModal).
 */
export const LOGO_HEIGHT = 34;

/**
 * The card modal's title: the card's name, with its set's logo beside it on desktop
 * (owner, 2026-10-08). Phones show the name alone, since there the logo would put
 * about twice as many names on two lines (27% of them to 59%, measured). The logo
 * sits outside the heading, so the heading reads the name alone. Shared with the
 * loading fallback, so nothing moves when the modal arrives.
 */
export function ModalCardTitle({card, isMobile, as: Title = 'h1'}: ModalCardTitleProps) {
  const logo = !isMobile && card.setCode ? SET_LOGOS[card.setCode] : undefined;
  const setName = SET_NAMES[card.setCode as SetCode] ?? `Set ${card.setCode}`;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.md, flex: 1, minWidth: 0}}>
      <Title style={{...pickModalTitleStyle(isMobile), flex: '0 1 auto'}}>{card.fullName}</Title>
      {logo && (
        <img
          src={logo}
          alt={setName}
          title={setName}
          style={{display: 'block', height: LOGO_HEIGHT, width: 'auto', flexShrink: 0}}
        />
      )}
    </div>
  );
}
