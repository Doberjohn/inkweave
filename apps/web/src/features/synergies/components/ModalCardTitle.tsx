import type {CSSProperties} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONT_SIZES, SET_LOGOS, SET_NAMES, SPACING, TABULAR, type SetCode} from '../../../shared/constants';
import {printedCardNumber, type Printing} from '../../../shared/hooks';
import {pickModalTitleStyle} from './cardOverviewModalStyles';

interface ModalCardTitleProps {
  card: LorcanaCard;
  isMobile: boolean;
  /** The printing on show, whose number the title reads; the card's own when absent. */
  printing?: Printing;
  /** `h1` in the modal; the loading fallback, a status region, uses a `div`. */
  as?: 'h1' | 'div';
}

/** The card's number beside the logo: muted, and in even-width digits. */
const NUMBER_STYLE: CSSProperties = {
  ...TABULAR,
  fontSize: FONT_SIZES.xl,
  fontWeight: 600,
  color: COLORS.textMuted,
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

/** Kept for screen readers, hidden on screen. */
const SR_ONLY_STYLE: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** The number printed on the card ("52/204", `printedCardNumber`), read as a card number. */
function CardNumber({number}: {number: string}) {
  return (
    <span style={NUMBER_STYLE}>
      <span style={SR_ONLY_STYLE}>Card number </span>
      {number}
    </span>
  );
}

/**
 * The logo's height, which also sets the desktop header's (the title's line and the close
 * button are shorter). Every card shows one, so the header keeps one height while paging; in
 * a comparison BACK takes the title's place and keeps this height too (CardOverviewModal).
 */
export const LOGO_HEIGHT = 34;

/**
 * The card modal's title: the card's name, with its set's logo beside it on desktop
 * (owner, 2026-10-08), then the number printed on the printing on show (owner,
 * 2026-10-20). Phones show the name alone, since there the logo would put about twice
 * as many names on two lines (27% of them to 59%, measured). The logo and the number
 * sit outside the heading, so the heading reads the name alone. Shared with the loading
 * fallback, so nothing moves when the modal arrives.
 */
export function ModalCardTitle({card, isMobile, printing, as: Title = 'h1'}: ModalCardTitleProps) {
  const logo = !isMobile && card.setCode ? SET_LOGOS[card.setCode] : undefined;
  const setName = SET_NAMES[card.setCode as SetCode] ?? `Set ${card.setCode}`;
  const number = isMobile ? undefined : printedCardNumber(card, printing);
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
      {number && <CardNumber number={number} />}
    </div>
  );
}
