import {useState} from 'react';
import type {CSSProperties} from 'react';
import type {LorcanaCard} from '../deck/types';
import type {CollectionEntries} from './collectionParser';
import {tallySet} from './collectionStats';
import {IconButton} from '../../shared/components';
import {
  CAP_LABEL_XS,
  COLORS,
  FONT_SIZES,
  FONTS,
  INK_COLORS,
  RADIUS,
  SET_NAMES,
  SPACING,
  TABULAR,
  hexRgba,
} from '../../shared/constants';

/**
 * DESIGN SPIKE — the set-stats panel beside the collection binder.
 *
 * Built to be COMPARED, not shipped: `?stats=fixed|rail|auto|off` picks how it
 * behaves, because the panel costs card width at every viewport and the only
 * honest way to judge that trade is against real cards at real sizes. Measured
 * card width at 1440x900: 150px with no panel, 109px with a 320px one.
 *
 * THE DENOMINATOR IS THE WHOLE DESIGN (owner, 2026-08-14). A Dreamborn export
 * contains exactly five rarities — Common, Uncommon, Rare, Super Rare, Legendary
 * — verified across all 5,329 rows of a real one. Enchanted, Special, Epic and
 * Iconic are never in it, so those slots can never be filled by an import and
 * counting them would put 100% permanently out of reach. Set 1 is 216 binder
 * slots but only 204 importable; the owner holds all 204. The panel therefore
 * reports IMPORTABLE as the headline and names the chase cards separately, which
 * is also what explains the grey slots sitting in the binder beside it.
 */

/** Sets with logo art on disk. The rest fall back to their name. */
const SET_LOGOS: Record<string, string> = {
  '1': '/art/sets/the-first-chapter.png',
  '2': '/art/sets/rise-of-the-floodborn.png',
  '12': '/art/sets/wilds-unknown.png',
  '13': '/art/sets/attack-of-the-vine.png',
};

export type StatsMode = 'fixed' | 'rail' | 'auto' | 'off';

/** Width of the open panel, and of the collapsed strip. */
export const PANEL_WIDTH = 260;
export const RAIL_WIDTH = 40;

/** Above this container width the panel can be open without starving the cards. */
const AUTO_OPEN_MIN_WIDTH = 1500;

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));

function Bar({value, total, color}: {value: number; total: number; color: string}) {
  const done = value === total && total > 0;
  return (
    <div
      style={{
        height: 6,
        borderRadius: `${RADIUS.pill}px`,
        background: hexRgba(COLORS.background, 0.6),
        overflow: 'hidden',
      }}>
      <div
        style={{
          height: '100%',
          width: `${pct(value, total)}%`,
          background: done ? COLORS.primary : color,
          borderRadius: `${RADIUS.pill}px`,
        }}
      />
    </div>
  );
}

function Row({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const done = value === total && total > 0;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 3}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <span style={{fontSize: `${FONT_SIZES.xs}px`, color: done ? COLORS.primary : COLORS.textMuted}}>
          {label}
        </span>
        <span style={{...TABULAR, fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textMuted}}>
          {value}/{total}
        </span>
      </div>
      <Bar value={value} total={total} color={color} />
    </div>
  );
}

function Headline({label, value, total}: {label: string; value: number; total: number}) {
  const done = value === total && total > 0;
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.xxs}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <span style={{...CAP_LABEL_XS, color: COLORS.textMuted}}>{label}</span>
        <span
          style={{
            ...TABULAR,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.xxl}px`,
            fontWeight: 700,
            color: done ? COLORS.primary : COLORS.text,
            lineHeight: 1,
          }}>
          {pct(value, total)}%
        </span>
      </div>
      <Bar value={value} total={total} color={COLORS.success} />
      <span style={{...TABULAR, fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textDim}}>
        {value} of {total} cards
      </span>
    </div>
  );
}

function SetHeader({setCode}: {setCode: string}) {
  const logo = SET_LOGOS[setCode];
  const name = SET_NAMES[setCode as keyof typeof SET_NAMES] ?? `Set ${setCode}`;
  // Logos vary from 1.4:1 to 3.3:1, so the box is fixed and the art is contained
  // rather than sized — otherwise a wide logo and a squarish one give the panel
  // two different header heights.
  return (
    <div style={{height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {logo === undefined ? (
        <span
          style={{
            fontFamily: FONTS.hero,
            fontSize: `${FONT_SIZES.lg}px`,
            color: COLORS.text,
            textAlign: 'center',
            lineHeight: 1.2,
          }}>
          {name}
        </span>
      ) : (
        <img
          src={logo}
          alt={name}
          style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}}
        />
      )}
    </div>
  );
}

const panelStyle: CSSProperties = {
  width: PANEL_WIDTH,
  flexShrink: 0,
  background: COLORS.surface,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: `${RADIUS.card}px`,
  padding: SPACING.md,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.md,
  overflowY: 'auto',
};

interface Props {
  /** The set's binder cards, chase rarities included. */
  cards: LorcanaCard[];
  entries: CollectionEntries;
  setCode: string;
  mode: StatsMode;
  /** Available width, so `auto` can decide. */
  containerWidth: number;
}

export function CollectionSetStats({cards, entries, setCode, mode, containerWidth}: Props) {
  const [railOpen, setRailOpen] = useState(false);
  if (mode === 'off') return null;

  const t = tallySet(cards, entries);
  const open = mode === 'fixed' || (mode === 'auto' && containerWidth >= AUTO_OPEN_MIN_WIDTH);
  /**
   * The breakdowns follow whichever axis you still have work on (owner,
   * 2026-08-14). On a finished set every complete-bar reads 100% and the panel
   * becomes a wall of identical gold telling you nothing — Set 1 looked exactly
   * like that. Switching to master once complete is done keeps it answering a
   * live question instead of congratulating you six times.
   */
  const axis: 'complete' | 'master' = t.complete === t.importable && t.importable > 0 ? 'master' : 'complete';

  const body = (
    <>
      <SetHeader setCode={setCode} />
      <Headline label="Complete set" value={t.complete} total={t.importable} />
      <Headline label="Master set" value={t.master} total={t.importable} />
      {t.chase > 0 && (
        <span style={{fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textDim, lineHeight: 1.4}}>
          {t.chaseHeld} of {t.chase} chase cards — never in an export, so they are yours to add by
          hand.
        </span>
      )}
      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
        <span style={{...CAP_LABEL_XS, color: COLORS.textMuted}}>
          By ink · {axis}
        </span>
        {t.byInk.map((r) => (
          <Row
            key={r.ink}
            label={r.ink}
            value={r[axis]}
            total={r.total}
            color={INK_COLORS[r.ink]?.border ?? COLORS.textMuted}
          />
        ))}
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
        <span style={{...CAP_LABEL_XS, color: COLORS.textMuted}}>
          By rarity · {axis}
        </span>
        {t.byRarity.map((r) => (
          <Row key={r.rarity} label={r.rarity} value={r[axis]} total={r.total} color={COLORS.success} />
        ))}
      </div>
    </>
  );

  if (open) return <aside style={panelStyle}>{body}</aside>;

  // Collapsed: the two headline numbers stay readable sideways, and opening
  // overlays the binder rather than resizing it — so the cards never move.
  return (
    <aside
      style={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        position: 'relative',
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: `${RADIUS.card}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: SPACING.sm,
        padding: `${SPACING.sm}px 0`,
      }}>
      <IconButton
        aria-label={railOpen ? 'Hide set stats' : 'Show set stats'}
        size={28}
        onClick={() => setRailOpen((v) => !v)}
        style={{color: COLORS.primary}}>
        {railOpen ? '‹' : '›'}
      </IconButton>
      <span
        style={{
          ...TABULAR,
          writingMode: 'vertical-rl',
          fontSize: `${FONT_SIZES.xs}px`,
          color: COLORS.textMuted,
          letterSpacing: '0.08em',
        }}>
        {pct(t.complete, t.importable)}% complete · {pct(t.master, t.importable)}% master
      </span>
      {railOpen && (
        <div
          style={{
            ...panelStyle,
            position: 'absolute',
            left: RAIL_WIDTH + SPACING.xs,
            top: 0,
            maxHeight: '100%',
            zIndex: 5,
          }}>
          {body}
        </div>
      )}
    </aside>
  );
}
