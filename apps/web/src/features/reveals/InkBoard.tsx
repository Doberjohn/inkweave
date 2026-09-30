import './reveals.css';
import {useState} from 'react';
import type {CardPrinting, Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, EASING, FONTS, FONT_SIZES, INK_COLORS, RADIUS, blackRgba, hexRgba} from '../../shared/constants';
import {InkIcon} from '../../shared/components/InkIcon';
import {CardMosaic} from './CardMosaic';
import {RarityBreakdown} from './RarityBreakdown';
import {SpecialPrintings} from './SpecialPrintings';
import {PER_INK} from './setComposition';
import {inkRgba} from './inkTint';
import {SPECIAL_RARITIES, type RarityConfig} from './rarity';
import type {InkProgress, SpecialSlot} from './useRevealProgress';

interface InkBoardProps {
  progress: InkProgress;
  /** Opens the card modal when a revealed slot is clicked. */
  onOpen?: (card: LorcanaCard) => void;
  /** Opens the card modal on a special printing when its slot is clicked. */
  onOpenPrinting?: (card: LorcanaCard, printing: CardPrinting) => void;
  /** Mobile sizing. */
  compact?: boolean;
}

/**
 * The board header: a floating ink badge, the "INK BOARD" eyebrow + ink name, and
 * the `count / 34` with a "COLOR COMPLETE" ribbon at full. Held to its own
 * component so its `compact`/`done` branches don't pile onto InkBoard.
 */
function BoardHeader({ink, count, compact}: {ink: Ink; count: number; compact: boolean}) {
  const done = count >= PER_INK[ink];
  const inkText = INK_COLORS[ink].text;
  const badgeSize = compact ? 52 : 70;
  const symbolSize = compact ? 32 : 44;

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap'}}>
      <div
        style={{
          width: badgeSize,
          height: badgeSize,
          borderRadius: compact ? RADIUS.card : RADIUS.xl,
          flex: '0 0 auto',
          background: `radial-gradient(circle at 50% 35%, ${inkRgba(ink, 0.28)}, ${hexRgba(COLORS.background, 0.6)})`,
          border: `1px solid ${inkRgba(ink, 0.5)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 26px ${inkRgba(ink, 0.3)}`,
        }}
      >
        <span
          className="reveal-anim"
          style={{
            lineHeight: 0,
            filter: `drop-shadow(0 2px 8px ${inkRgba(ink, 0.7)})`,
            animation: `reveal-floatY 4s ${EASING.smooth} infinite`,
          }}
        >
          <InkIcon ink={ink} size={symbolSize} />
        </span>
      </div>

      <div>
        <div style={{fontWeight: 600, fontSize: FONT_SIZES.sm, letterSpacing: 2.4, textTransform: 'uppercase', color: inkText}}>
          Ink board
        </div>
        <div
          style={{
            fontFamily: FONTS.hero,
            fontWeight: 700,
            fontSize: compact ? FONT_SIZES.xxxl : FONT_SIZES.displaySm,
            color: COLORS.gray900,
            lineHeight: 1.05,
            marginTop: 3,
          }}
        >
          {ink}
        </div>
      </div>

      <div style={{marginLeft: 'auto', textAlign: 'right'}}>
        <div style={{fontWeight: 800, fontSize: compact ? FONT_SIZES.displaySm : FONT_SIZES.displayMd, color: COLORS.primary, lineHeight: 1}}>
          {count}
          <span style={{fontSize: compact ? FONT_SIZES.lg : FONT_SIZES.xxl, fontWeight: 700, color: COLORS.textDim}}> / {PER_INK[ink]}</span>
        </div>
        {done ? (
          <div
            className="reveal-anim"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 8,
              fontWeight: 700,
              fontSize: FONT_SIZES.sm,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: COLORS.background,
              padding: '5px 14px',
              borderRadius: RADIUS.pill,
              background: `linear-gradient(90deg, ${COLORS.primaryMuted}, ${COLORS.primaryHover}, ${COLORS.primaryMuted})`,
              backgroundSize: '200% 100%',
              animation: 'reveal-ribbonShine 2.4s linear infinite',
            }}
          >
            Color complete
          </div>
        ) : (
          <div style={{fontWeight: 500, fontSize: FONT_SIZES.sm, letterSpacing: 1.4, textTransform: 'uppercase', color: COLORS.textMuted, marginTop: 9}}>
            Revealed so far
          </div>
        )}
      </div>
    </div>
  );
}

/** The board's special printing rarities in lineup order, for the rarity breakdown's chips. */
function specialRaritiesOf(specials: SpecialSlot[]): RarityConfig[] {
  return [...new Set(specials.map((slot) => slot.rarity))].map((rarity) => SPECIAL_RARITIES[rarity]);
}

/**
 * The featured board for one ink: a header (badge + name + count, with a
 * "COLOR COMPLETE" ribbon at 34), the diamond mosaic, the special printings row,
 * and the rarity breakdown. The panel glow and the bloom behind the header both
 * scale with fill (count/34), so a fuller board visibly radiates more.
 */
export function InkBoard({progress, onOpen, onOpenPrinting, compact = false}: InkBoardProps) {
  const {ink, count, cards, rarityCounts, specials} = progress;
  const fill = count / PER_INK[ink];
  const bloomColor = inkRgba(ink, 0.1 + fill * 0.14);
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  // Toggle: click the active rarity to clear it, click another to switch.
  const toggleRarity = (key: string) => setSelectedRarity((prev) => (prev === key ? null : key));

  return (
    <div
      style={{
        position: 'relative',
        background: COLORS.background,
        border: `1px solid ${inkRgba(ink, 0.28)}`,
        borderRadius: RADIUS.card,
        padding: compact ? '18px 16px' : '26px 30px 24px',
        overflow: 'hidden',
        boxShadow: `0 18px 60px ${blackRgba(0.5)}, 0 0 ${30 + fill * 60}px ${inkRgba(ink, 0.06 + fill * 0.16)}`,
      }}
    >
      {/* Radial bloom behind the header; intensity scales with fill. The phone board
          is tall and narrow, where a circle in a 70%-wide box overflows the box and
          gets cut off with hard vertical edges. There the bloom spans the whole
          panel and its ellipse fits the box (closest-side), fading out at every edge. */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '50%',
          width: compact ? '100%' : '70%',
          height: '60%',
          transform: 'translateX(-50%)',
          background: compact
            ? `radial-gradient(ellipse closest-side, ${bloomColor}, transparent)`
            : `radial-gradient(circle, ${bloomColor}, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{position: 'relative'}}>
        <BoardHeader ink={ink} count={count} compact={compact} />

        <div style={{marginTop: 22}}>
          {/* key={ink} re-mounts the mosaic on each color switch so a fresh set of
              random slots bursts in (see CardMosaic's pop logic). */}
          <CardMosaic key={ink} ink={ink} cards={cards} onOpen={onOpen} compact={compact} selectedRarity={selectedRarity} />
        </div>

        {specials.length > 0 && (
          <SpecialPrintings
            ink={ink}
            slots={specials}
            onOpenPrinting={onOpenPrinting}
            compact={compact}
            selectedRarity={selectedRarity}
          />
        )}

        <RarityBreakdown
          rarityCounts={rarityCounts}
          specialRarities={specialRaritiesOf(specials)}
          compact={compact}
          selectedRarity={selectedRarity}
          onSelectRarity={toggleRarity}
        />
      </div>
    </div>
  );
}
