import type {CSSProperties, ReactNode} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {
  COLORS,
  FONT_SIZES,
  RADIUS,
  SET_LOGOS,
  SET_NAMES,
  SPACING,
  TABULAR,
  VISUALLY_HIDDEN,
  type SetCode,
} from '../../../shared/constants';
import {printedCardNumber, printedFullName, type Printing} from '../../../shared/hooks';
import {pickModalTitleStyle} from './cardOverviewModalStyles';

interface ModalCardTitleProps {
  card: LorcanaCard;
  isMobile: boolean;
  /** The printing on show, whose name and number the title reads; the card's own when absent. */
  printing?: Printing;
  /** `h1` in the modal; the loading fallback, a status region, uses a `div`. */
  as?: 'h1' | 'div';
  /** After the logo on desktop (the window's friends slot): on the same line, or under a name too long to share it. */
  trailing?: ReactNode;
}

/**
 * The card's number before the logo: a small muted tag, in even-width digits, that sets it
 * apart from the name (owner, 2026-10-22). A label, never a control.
 */
const NUMBER_TAG_STYLE: CSSProperties = {
  ...TABULAR,
  fontSize: FONT_SIZES.base,
  fontWeight: 600,
  lineHeight: 1.4,
  color: COLORS.textMuted,
  background: COLORS.surfaceRaised,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: RADIUS.sm,
  padding: `${SPACING.xxs}px ${SPACING.sm}px`,
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

/** The number printed on the card ("52/204", `printedCardNumber`), read as a card number. */
function CardNumber({number}: {number: string}) {
  return (
    <span style={NUMBER_TAG_STYLE}>
      <span style={VISUALLY_HIDDEN}>Card number </span>
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
 * The card modal's title: the name printed on the printing on show (`printedFullName`, so
 * 26/P2's European printing reads Vaiana, #891), then on desktop the number printed on that
 * printing (owner, 2026-10-20) and its set's logo (owner, 2026-10-08). The number comes first,
 * as the card prints it before its set, "52/204 · EN · 11" (owner, 2026-10-22). Phones show
 * the name alone, since there the logo would put about twice as many names on two lines (27%
 * of them to 59%, measured). The number and the logo sit outside the heading, so the heading
 * reads the name alone. Shared with the loading fallback, so nothing moves when the modal
 * arrives.
 */
export function ModalCardTitle({card, isMobile, printing, as: Title = 'h1', trailing}: ModalCardTitleProps) {
  const logo = !isMobile && card.setCode ? SET_LOGOS[card.setCode] : undefined;
  const setName = SET_NAMES[card.setCode as SetCode] ?? `Set ${card.setCode}`;
  const number = isMobile ? undefined : printedCardNumber(card, printing);
  const name = printedFullName(card, printing?.printedName);
  return (
    <div style={TITLE_ROW_STYLE}>
      <div style={TITLE_STYLE}>
        <Title style={{...pickModalTitleStyle(isMobile), flex: '0 1 auto'}}>{name}</Title>
        {number && <CardNumber number={number} />}
        {logo && (
          <img
            src={logo}
            alt={setName}
            title={setName}
            style={{display: 'block', height: LOGO_HEIGHT, width: 'auto', flexShrink: 0}}
          />
        )}
      </div>
      {trailing}
    </div>
  );
}

/**
 * The title, then what trails it, wrapping onto a line of its own rather than squeezing the
 * name: the name, its number and the logo shrink together only once they fill a line alone.
 */
const TITLE_ROW_STYLE: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: SPACING.md,
  rowGap: SPACING.sm,
  flex: 1,
  minWidth: 0,
};

const TITLE_STYLE: CSSProperties = {display: 'flex', alignItems: 'center', gap: SPACING.md, flex: '0 1 auto', minWidth: 0};
