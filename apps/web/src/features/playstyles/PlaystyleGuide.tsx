import type {CSSProperties, MouseEvent} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {cardPath} from 'inkweave-synergy-engine/card';
import {isModifiedClick} from 'inkweave-ui/utils/touchGuard';
import {InkIcon} from 'inkweave-ui/lorcana/InkIcon';
import {
  CAP_LABEL,
  COLORS,
  FONTS,
  FONT_SIZES,
  GOLD_GLOW,
  ICON_SIZE,
  RADIUS,
  SPACING,
} from '../../shared/constants';
import type {PlaystyleGuide as Guide} from './playstyleGuides';
import './playstyles.css';

/** The guide's reading column, the legal pages' (LegalPage). */
const GUIDE_MAX_WIDTH = 720;

const HEADING: CSSProperties = {
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.xxl,
  fontWeight: 700,
  color: COLORS.text,
  margin: `0 0 ${SPACING.md}px`,
};

const PARAGRAPH: CSSProperties = {
  fontSize: FONT_SIZES.xl,
  lineHeight: 1.7,
  color: COLORS.descriptionText,
  margin: `0 0 ${SPACING.lg}px`,
};

const KEY_CARDS_HEADING: CSSProperties = {...CAP_LABEL, margin: `${SPACING.xxl}px 0 ${SPACING.md}px`};

const KEY_CARD_LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: SPACING.sm,
};

/** A key card's link: a pill whose edge lights gold while pointed at (playstyles.css). */
const KEY_CARD = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: SPACING.sm,
  padding: `${SPACING.sm}px ${SPACING.md}px`,
  borderRadius: RADIUS.pill,
  background: COLORS.surface,
  color: COLORS.text,
  fontSize: FONT_SIZES.lg,
  fontWeight: 600,
  textDecoration: 'none',
  '--key-card-edge': COLORS.surfaceBorder,
  '--key-card-hover-edge': GOLD_GLOW.activeBorder,
  '--key-card-hover-glow': GOLD_GLOW.shadow,
} as CSSProperties;

export interface PlaystyleGuideProps {
  /** The playstyle's name, which the heading names. */
  name: string;
  /** The playstyle's guide. Without one, as while it loads or when it failed, nothing renders. */
  guide: Guide | undefined;
  /** The playstyle's cards. A key card not among them is left out, so a stale id never shows. */
  cards: LorcanaCard[];
  /** Opens a key card's window on a plain click, with the key cards shown as its list. */
  onOpenCard: (cardId: string, cardIds: string[]) => void;
  /** The card grid's padding, so the guide lines up with the cards above it. */
  padding: string;
}

/**
 * A playstyle's written guide, under its card grid (#995): how the deck wins, how to build it,
 * and its key cards. It gives the page words of its own for search. Each key card is a link to
 * its card page that opens the card's window on a plain click, as the grid's tiles do.
 */
export function PlaystyleGuide({name, guide, cards, onOpenCard, padding}: PlaystyleGuideProps) {
  if (!guide) return null;
  const byId = new Map(cards.map((card) => [card.id, card]));
  const keyCards = guide.keyCards.flatMap((id) => byId.get(id) ?? []);
  const open = (e: MouseEvent<HTMLAnchorElement>, card: LorcanaCard) => {
    if (isModifiedClick(e)) return; // let the browser open the card page in a new tab
    e.preventDefault();
    onOpenCard(
      card.id,
      keyCards.map((c) => c.id),
    );
  };

  return (
    <section aria-labelledby="playstyle-guide-heading" style={{padding}}>
      <div
        style={{
          maxWidth: GUIDE_MAX_WIDTH,
          borderTop: `1px solid ${COLORS.surfaceBorder}`,
          paddingTop: SPACING.xxxl,
        }}>
        <h2 id="playstyle-guide-heading" style={HEADING}>
          {`How to play ${name}`}
        </h2>
        {guide.paragraphs.map((text) => (
          <p key={text} style={PARAGRAPH}>
            {text}
          </p>
        ))}
        {keyCards.length > 0 && (
          <>
            <h3 style={KEY_CARDS_HEADING}>Key cards</h3>
            <ul style={KEY_CARD_LIST}>
              {keyCards.map((card) => (
                <li key={card.id}>
                  <a
                    className="playstyle-key-card"
                    href={cardPath(card)}
                    onClick={(e) => open(e, card)}
                    style={KEY_CARD}>
                    <InkIcon ink={card.ink} size={ICON_SIZE.sm} />
                    {card.ink2 && <InkIcon ink={card.ink2} size={ICON_SIZE.sm} />}
                    {card.fullName}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
