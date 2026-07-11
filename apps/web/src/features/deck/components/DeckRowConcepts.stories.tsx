import {useState, type CSSProperties, type ReactNode} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink} from 'inkweave-synergy-engine';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING} from '../../../shared/constants';
import {InkwellIcon} from '../../../shared/components/InkwellIcon';

// Concept exploration for the deck-panel row (DeckCardRow). KEPT as the living
// design reference (Deck / Design Explorations). `Concepts` = the A/B/C compare;
// `RefinedB` = the chosen mini-art direction with hover glow + inkable/cost + qty/max.
// Real cards (one per ink); controls here are non-interactive mockups.

const RB = 'https://api.lorcana.ravensburger.com/images/en';
const GOLD = COLORS.primary;
const RED = COLORS.error; //    decrement
const GREEN = COLORS.success; // increment

type CardGroup = 'Character' | 'Action' | 'Song' | 'Item' | 'Location';

interface RowCard {
  id: string;
  fullName: string;
  cost: number;
  ink: Ink;
  inkwell: boolean;
  imageUrl: string;
  qty: number;
  type: CardGroup;
}

const CARDS: RowCard[] = [
  {id: '1', type: 'Character', fullName: 'The Queen - Conceited Ruler', cost: 3, ink: 'Amber', inkwell: true, imageUrl: `${RB}/set9/1_93b7a7794fa098c50d7f82e099a8db3928a78f9d.jpg`, qty: 4},
  {id: '2', type: 'Character', fullName: 'Bruno Madrigal - Undetected Uncle', cost: 4, ink: 'Amethyst', inkwell: false, imageUrl: `${RB}/set9/0_056fe7b7709e9f6ab33e7d134bb084eca0ca74f6.jpg`, qty: 2},
  {id: '3', type: 'Character', fullName: 'Kuzco - Temperamental Emperor', cost: 5, ink: 'Emerald', inkwell: true, imageUrl: `${RB}/set9/69_a6126f19afa4cc53460116f2aaa51732adceaa05.jpg`, qty: 1},
  {id: '4', type: 'Character', fullName: 'LeFou - Instigator', cost: 2, ink: 'Ruby', inkwell: true, imageUrl: `${RB}/set9/103_819b37406bdbf9e3a2267a72ac7207892d5a6dfb.jpg`, qty: 3},
  {id: '5', type: 'Character', fullName: 'Anna - True-Hearted', cost: 4, ink: 'Sapphire', inkwell: false, imageUrl: `${RB}/set9/137_30b03ce9b58be1bc220632827d7d72051fe68876.jpg`, qty: 4},
  {id: '6', type: 'Character', fullName: 'Philoctetes - No-Nonsense Instructor', cost: 4, ink: 'Steel', inkwell: true, imageUrl: `${RB}/set9/171_3662018112dfd716842071ce702a08cfd0d428b8.jpg`, qty: 1},
];

function MinusGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function PlusGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="8" y1="4" x2="8" y2="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M10 4h4a1 1 0 0 1 1 1v2H9V5a1 1 0 0 1 1-1zM6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const stepBtn = (disabled: boolean): CSSProperties => ({
  width: 22,
  height: 22,
  borderRadius: RADIUS.sm,
  border: `1px solid ${COLORS.surfaceBorder}`,
  background: COLORS.surfaceAlt,
  color: disabled ? COLORS.textDim : COLORS.text,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: disabled ? 0.5 : 1,
});

function Stepper({qty}: {qty: number}) {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0}}>
      <div style={stepBtn(false)}>
        <MinusGlyph />
      </div>
      <span style={{minWidth: 16, textAlign: 'center', color: COLORS.text, fontFamily: FONTS.body, fontSize: FONT_SIZES.base, fontWeight: 700}}>
        {qty}
      </span>
      <div style={stepBtn(qty >= 4)}>
        <PlusGlyph />
      </div>
    </div>
  );
}

const rowBase: CSSProperties = {display: 'flex', alignItems: 'center', gap: SPACING.sm, padding: `5px ${SPACING.sm}px`, borderRadius: RADIUS.sm};
const nameStyle: CSSProperties = {flex: 1, minWidth: 0, color: COLORS.text, fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'};
const removeStyle: CSSProperties = {width: 20, textAlign: 'center', color: COLORS.textDim, fontSize: FONT_SIZES.lg, lineHeight: 1, flexShrink: 0, cursor: 'pointer'};

function RowA({c}: {c: RowCard}) {
  const ink = INK_COLORS[c.ink];
  return (
    <div style={rowBase}>
      <span style={{flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: ink.bg, color: ink.text, fontFamily: FONTS.body, fontSize: FONT_SIZES.md, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        {c.cost}
      </span>
      <span style={nameStyle}>{c.fullName}</span>
      <Stepper qty={c.qty} />
      <span style={removeStyle}>×</span>
    </div>
  );
}

function RowB({c}: {c: RowCard}) {
  const ink = INK_COLORS[c.ink];
  return (
    <div style={rowBase}>
      <div style={{width: 42, height: 30, borderRadius: RADIUS.sm, overflow: 'hidden', flexShrink: 0, border: `1px solid ${ink.border}`}}>
        <img src={c.imageUrl} alt="" style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 20%'}} />
      </div>
      <span style={nameStyle}>{c.fullName}</span>
      <Stepper qty={c.qty} />
      <span style={removeStyle}>×</span>
    </div>
  );
}

function RowC({c}: {c: RowCard}) {
  const ink = INK_COLORS[c.ink];
  return (
    <div style={{...rowBase, paddingLeft: 0, overflow: 'hidden'}}>
      <div style={{width: 4, alignSelf: 'stretch', background: ink.border, flexShrink: 0, borderRadius: 2}} />
      <span style={{flexShrink: 0, minWidth: 18, textAlign: 'center', color: ink.text, fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, fontWeight: 800}}>
        {c.cost}
      </span>
      <span style={nameStyle}>{c.fullName}</span>
      <Stepper qty={c.qty} />
      <span style={removeStyle}>×</span>
    </div>
  );
}

function Panel({title, note, Row}: {title: string; note: string; Row: (p: {c: RowCard}) => ReactNode}) {
  return (
    <div style={{width: 380}}>
      <div style={{fontFamily: FONTS.hero, color: COLORS.text, fontSize: FONT_SIZES.xl}}>{title}</div>
      <div style={{fontFamily: FONTS.body, color: COLORS.textMuted, fontSize: FONT_SIZES.md, margin: '2px 0 12px'}}>{note}</div>
      <div style={{background: COLORS.surface, border: `1px solid ${COLORS.surfaceBorder}`, borderRadius: RADIUS.card, padding: `${SPACING.sm}px 4px`}}>
        {CARDS.map((c) => (
          <Row key={c.id} c={c} />
        ))}
      </div>
    </div>
  );
}

// The chosen direction, enhanced: bigger spacing, gold glow-line on hover, the
// cost + inkable badge cluster, and qty / max. Hover a row (row 2 is pre-hovered
// so the glow shows in a static shot).
function RefinedBRow({c, forceHover}: {c: RowCard; forceHover?: boolean}) {
  const [hovered, setHovered] = useState(false);
  const on = hovered || forceHover;
  const ink = INK_COLORS[c.ink];
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        borderRadius: RADIUS.md,
        background: on ? `${GOLD}0f` : 'transparent',
        boxShadow: on ? `0 0 12px ${GOLD}30, inset 0 0 0 1px ${GOLD}55` : 'inset 0 0 0 1px transparent',
        transition: 'background 0.15s ease, box-shadow 0.15s ease',
      }}>
      <div style={{width: 46, height: 34, borderRadius: RADIUS.sm, overflow: 'hidden', flexShrink: 0, border: `1px solid ${ink.border}`}}>
        <img src={c.imageUrl} alt="" style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%'}} />
      </div>
      <span style={nameStyle}>{c.fullName}</span>
      <div style={{display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0}}>
        <span style={{width: 22, height: 22, borderRadius: '50%', background: ink.bg, color: ink.text, fontFamily: FONTS.body, fontSize: FONT_SIZES.md, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          {c.cost}
        </span>
        <InkwellIcon value={c.inkwell ? 'inkable' : 'uninkable'} size={16} />
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0}}>
        <div style={stepBtn(false)}>
          <MinusGlyph />
        </div>
        <span style={{minWidth: 30, textAlign: 'center', color: COLORS.text, fontFamily: FONTS.body, fontSize: FONT_SIZES.base, fontWeight: 700}}>
          {c.qty}
          <span style={{color: COLORS.textDim, fontWeight: 600}}> / 4</span>
        </span>
        <div style={stepBtn(c.qty >= 4)}>
          <PlusGlyph />
        </div>
      </div>
      <span style={{...removeStyle, color: on ? COLORS.textMuted : COLORS.textDim, transition: 'color 0.15s'}}>×</span>
    </div>
  );
}

const meta: Meta = {
  title: 'Deck/Design Explorations/DeckCardRow',
  parameters: {layout: 'fullscreen', backgrounds: {default: 'dark'}},
};
export default meta;
type Story = StoryObj;

export const Concepts: Story = {
  render: () => (
    <div style={{padding: 32, background: COLORS.background, minHeight: '100vh'}}>
      <h2 style={{fontFamily: FONTS.hero, color: COLORS.text, fontSize: FONT_SIZES.xxl, margin: '0 0 24px'}}>Deck panel row · concepts</h2>
      <div style={{display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start'}}>
        <Panel title="A · Cost badge" note="Ink cost badge + name + stepper. Refined current row." Row={RowA} />
        <Panel title="B · Mini art" note="A small card-art crop for quick visual ID." Row={RowB} />
        <Panel title="C · Ink stripe" note="Left ink stripe; cost as a tinted number." Row={RowC} />
      </div>
    </div>
  ),
};

export const RefinedB: Story = {
  render: () => (
    <div style={{padding: 32, background: COLORS.background, minHeight: '100vh'}}>
      <h2 style={{fontFamily: FONTS.hero, color: COLORS.text, fontSize: FONT_SIZES.xxl, margin: '0 0 4px'}}>Deck row · B refined (mini art)</h2>
      <p style={{fontFamily: FONTS.body, color: COLORS.textMuted, fontSize: FONT_SIZES.base, margin: '0 0 20px'}}>
        Bigger row spacing, a light gold glow-line on hover, cost + inkable badge, and qty / max. Hover a
        row (row 2 is pre-hovered).
      </p>
      <div style={{width: 700, background: COLORS.surface, border: `1px solid ${COLORS.surfaceBorder}`, borderRadius: RADIUS.card, padding: SPACING.md, display: 'flex', flexDirection: 'column', gap: 4}}>
        {CARDS.map((c, i) => (
          <RefinedBRow key={c.id} c={c} forceHover={i === 1} />
        ))}
      </div>
    </div>
  ),
};

// ── Panel shell (tabs) + the four animations ────────────────────────────────
const KEYFRAMES = `
@keyframes ptRowEnter { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ptQtyPop { from { transform: scale(1.5); } to { transform: scale(1); } }
`;

// One glyph per card: the inkable / uninkable filter symbol (InkwellIcon) with the
// cost number overlaid dead-centre — mirrors the real card (the cost sits inside the
// inkwell symbol) and folds cost + inkability into a single mark.
function CostGlyph({cost, inkwell, size}: {cost: number; inkwell: boolean; size: number}) {
  const label = cost >= 9 ? '9+' : String(cost);
  const fontSize = cost >= 9 ? size * 0.3 : size * 0.36;
  return (
    <span style={{position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, flexShrink: 0}}>
      <InkwellIcon value={inkwell ? 'inkable' : 'uninkable'} size={size} decorative={false} />
      <span style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', fontSize, fontWeight: 700, lineHeight: 1, pointerEvents: 'none', userSelect: 'none'}}>
        {label}
      </span>
    </span>
  );
}

// Quantity stepper matching the pool grid's pill (PoolCardTile): a gold-bordered pill
// with a red − / green +, the − / + collapsing to width 0 at rest and growing on row
// hover. NOTE for the real build: extract this into a shared QuantityStepper used by
// both PoolCardTile and DeckCardRow rather than duplicating it.
const qtyCell: CSSProperties = {minWidth: 30, height: '100%', padding: '0 6px', border: 'none', background: 'transparent', fontFamily: FONTS.body, fontWeight: 800, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'};

function qtySideBtn(shown: boolean, disabled: boolean, color: string): CSSProperties {
  return {...qtyCell, minWidth: 0, width: shown ? 28 : 0, opacity: shown ? 1 : 0, padding: 0, color: disabled ? COLORS.textDim : color, cursor: disabled ? 'default' : 'pointer', overflow: 'hidden', transition: 'width 0.2s ease, opacity 0.18s ease, color 0.15s ease'};
}

interface LiveRow extends RowCard {
  key: string;
}

// A mock deck spanning all five groups (real cards + thumbnails). Mixed inks for the
// glow demo — NOT a legal 2-ink deck — and mixed inkable/uninkable for the glyph.
const DECK: RowCard[] = [
  {id: 'c1', type: 'Character', fullName: 'The Queen - Conceited Ruler', cost: 3, ink: 'Amber', inkwell: true, imageUrl: `${RB}/set9/1_93b7a7794fa098c50d7f82e099a8db3928a78f9d.jpg`, qty: 4},
  {id: 'c2', type: 'Character', fullName: 'Bruno Madrigal - Undetected Uncle', cost: 4, ink: 'Amethyst', inkwell: true, imageUrl: `${RB}/set9/0_056fe7b7709e9f6ab33e7d134bb084eca0ca74f6.jpg`, qty: 2},
  {id: 'c3', type: 'Character', fullName: 'Kuzco - Temperamental Emperor', cost: 5, ink: 'Emerald', inkwell: true, imageUrl: `${RB}/set9/69_a6126f19afa4cc53460116f2aaa51732adceaa05.jpg`, qty: 1},
  {id: 'c4', type: 'Character', fullName: 'LeFou - Instigator', cost: 2, ink: 'Ruby', inkwell: true, imageUrl: `${RB}/set9/103_819b37406bdbf9e3a2267a72ac7207892d5a6dfb.jpg`, qty: 3},
  {id: 'c5', type: 'Character', fullName: 'Anna - True-Hearted', cost: 4, ink: 'Sapphire', inkwell: false, imageUrl: `${RB}/set9/137_30b03ce9b58be1bc220632827d7d72051fe68876.jpg`, qty: 4},
  {id: 'a1', type: 'Action', fullName: "Bruno's Return", cost: 2, ink: 'Amber', inkwell: false, imageUrl: `${RB}/set9/29_6c5411527a850fe20562f4f0cd4ea8e9f0a2a588.jpg`, qty: 2},
  {id: 'a2', type: 'Action', fullName: 'Last-Ditch Effort', cost: 3, ink: 'Amethyst', inkwell: false, imageUrl: `${RB}/set9/62_1db1733133b8ce6abdba57238476b440f005d324.jpg`, qty: 2},
  {id: 's1', type: 'Song', fullName: 'Heal What Has Been Hurt', cost: 3, ink: 'Amber', inkwell: true, imageUrl: `${RB}/set9/27_9a6cbaef607009caebe172473534c1520b85b4b9.jpg`, qty: 3},
  {id: 's2', type: 'Song', fullName: 'Look at This Family', cost: 7, ink: 'Amber', inkwell: true, imageUrl: `${RB}/set9/25_9dfadcb6f520a6b4f669356ee3e708b90203c82f.jpg`, qty: 1},
  {id: 'i1', type: 'Item', fullName: 'Lantern', cost: 2, ink: 'Amber', inkwell: false, imageUrl: `${RB}/set9/32_c4b56c9ae7915c4401bd6946eaa828caa5478ee4.jpg`, qty: 2},
  {id: 'i2', type: 'Item', fullName: 'The Magic Feather', cost: 2, ink: 'Amethyst', inkwell: true, imageUrl: `${RB}/set9/64_e44f90862364d6a5242005e99ed15aed2caf995e.jpg`, qty: 2},
  {id: 'l1', type: 'Location', fullName: 'Atlantica - Concert Hall', cost: 1, ink: 'Amber', inkwell: true, imageUrl: `${RB}/set9/34_ee0d239951bc0f6e7f54b327711424dcf0716a24.jpg`, qty: 1},
  {id: 'l2', type: 'Location', fullName: 'Casa Madrigal - Casita', cost: 1, ink: 'Amethyst', inkwell: true, imageUrl: `${RB}/set9/68_e2318749d41cea23bafffccdfbbfa7f0cb7873d2.jpg`, qty: 1},
];

// The "+ Add a card" button cycles these — spread across groups so adding shows
// cards landing in different sections.
const ADDABLE: RowCard[] = [
  {id: 'x1', type: 'Character', fullName: 'Pongo - Determined Father', cost: 3, ink: 'Amber', inkwell: true, imageUrl: `${RB}/set9/2_b3a460cfa62417b403cc1fc210a582cb81f908c0.jpg`, qty: 1},
  {id: 'x2', type: 'Item', fullName: "Ursula's Shell Necklace", cost: 3, ink: 'Amber', inkwell: false, imageUrl: `${RB}/set9/33_6092ccc36e9812be6a7e80cb3b98ae71503a9cd0.jpg`, qty: 1},
  {id: 'x3', type: 'Location', fullName: 'Hidden Cove - Tranquil Haven', cost: 1, ink: 'Emerald', inkwell: true, imageUrl: `${RB}/set9/102_5711c595508ef14e00f3fbc2c2fad56db30ef390.jpg`, qty: 1},
  {id: 'x4', type: 'Action', fullName: "I'm Stuck!", cost: 1, ink: 'Amethyst', inkwell: true, imageUrl: `${RB}/set9/63_6ba2958e18e030e8559f2eeff9db8439653af6d5.jpg`, qty: 1},
];

const GROUP_ORDER: CardGroup[] = ['Character', 'Action', 'Song', 'Item', 'Location'];
const GROUP_LABEL: Record<CardGroup, string> = {Character: 'Characters', Action: 'Actions', Song: 'Songs', Item: 'Items', Location: 'Locations'};

// The card preview shown by the docked (left) peek, and the floating (cursor) peek.
function CardPreview({card, width}: {card: RowCard; width: number}) {
  return (
    <div style={{width, borderRadius: RADIUS.card, overflow: 'hidden', border: `2px solid ${INK_COLORS[card.ink].border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.6)'}}>
      <img src={card.imageUrl} alt="" style={{width: '100%', display: 'block'}} />
    </div>
  );
}

function AnimRow({row, hovered, onRowEnter, onRowLeave, onPeekEnter, onInc, onDec, onRemove}: {
  row: LiveRow;
  hovered: boolean;
  onRowEnter: () => void;
  onRowLeave: () => void;
  onPeekEnter: () => void;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
}) {
  const ink = INK_COLORS[row.ink];
  return (
    <div
      onMouseEnter={onRowEnter}
      onMouseLeave={onRowLeave}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        padding: `${SPACING.sm}px ${SPACING.md}px`,
        borderRadius: RADIUS.md,
        // Hover glow uses the card's own ink colour (INK_COLORS[ink].border, the
        // canonical ink RGB) with hex-alpha suffixes, the same pattern the filter
        // buttons use (`${color}30`).
        background: hovered ? `${ink.border}14` : 'transparent',
        boxShadow: hovered ? `0 0 14px ${ink.border}40, inset 0 0 0 1px ${ink.border}66` : 'inset 0 0 0 1px transparent',
        transition: 'background 0.15s ease, box-shadow 0.15s ease',
        animation: 'ptRowEnter 0.28s ease-out',
      }}>
      {/* Cost inside the inkable / uninkable symbol, leading the row. */}
      <CostGlyph cost={row.cost} inkwell={row.inkwell} size={28} />
      {/* Peek target: only the thumbnail + name fire the docked preview, so it never
          reacts to the row's own controls. */}
      <div
        onMouseEnter={onPeekEnter}
        style={{display: 'flex', alignItems: 'center', gap: SPACING.md, flex: 1, minWidth: 0, cursor: 'pointer'}}>
        <div style={{width: 46, height: 34, borderRadius: RADIUS.sm, overflow: 'hidden', flexShrink: 0, border: `1px solid ${ink.border}`}}>
          <img src={row.imageUrl} alt="" style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%'}} />
        </div>
        <span style={nameStyle}>{row.fullName}</span>
      </div>
      {/* Always-open quantity stepper — the pool grid's pill (gold border, red − / green +). */}
      <div style={{display: 'inline-flex', alignItems: 'stretch', height: 30, borderRadius: 15, border: `1px solid ${GOLD}80`, background: 'rgba(13, 13, 20, 0.94)', overflow: 'hidden', flexShrink: 0}}>
        <button type="button" style={qtySideBtn(true, false, RED)} onClick={onDec} aria-label="Remove one copy">
          <MinusGlyph />
        </button>
        <span key={row.qty} style={{...qtyCell, color: COLORS.text, fontSize: FONT_SIZES.xl, animation: 'ptQtyPop 0.22s ease-out'}}>
          {row.qty}
        </span>
        <button type="button" style={qtySideBtn(true, row.qty >= 4, GREEN)} onClick={onInc} disabled={row.qty >= 4} aria-label="Add one copy">
          <PlusGlyph />
        </button>
      </div>
      <button type="button" onClick={onRemove} aria-label={`Remove ${row.fullName} from deck`} style={{width: 26, height: 26, flexShrink: 0, border: 'none', background: 'transparent', color: hovered ? COLORS.textMuted : COLORS.textDim, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s'}}>
        <TrashIcon />
      </button>
    </div>
  );
}

function AnalysisPlaceholder() {
  const zones = ['Deck quality score', 'Cost curve', 'Ink balance', 'Synergies & key cards', 'Vulnerabilities · what to watch for', 'Suggestions'];
  return (
    <div style={{padding: SPACING.md, display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
      <p style={{fontFamily: FONTS.body, color: COLORS.textMuted, fontSize: FONT_SIZES.md, margin: 0}}>
        Reserved for the advisor (#472). The analysis backend already exists; this tab is where it surfaces.
      </p>
      {zones.map((z) => (
        <div key={z} style={{border: `1px dashed ${COLORS.surfaceBorder}`, borderRadius: RADIUS.md, padding: SPACING.md, color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.base}}>
          {z}
        </div>
      ))}
    </div>
  );
}

function PanelShellDemo() {
  const [tab, setTab] = useState<'cards' | 'analysis'>('cards');
  const [rows, setRows] = useState<LiveRow[]>(() => DECK.map((c, i) => ({...c, key: `init-${i}`})));
  const [leaving, setLeaving] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const [peekCard, setPeekCard] = useState<RowCard | null>(null);
  const [counter, setCounter] = useState(0);
  const total = rows.reduce((n, r) => n + r.qty, 0);

  const addCard = () => {
    const c = ADDABLE[counter % ADDABLE.length];
    setRows((r) => [...r, {...c, key: `add-${counter}`}]);
    setCounter((x) => x + 1);
  };
  const changeQty = (key: string, delta: number) =>
    setRows((r) => r.map((row) => (row.key === key ? {...row, qty: Math.max(1, Math.min(4, row.qty + delta))} : row)));

  const tabBtn = (t: 'cards' | 'analysis', label: string) => (
    <button type="button" onClick={() => setTab(t)} style={{border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONTS.body, fontSize: FONT_SIZES.lg, fontWeight: 700, color: tab === t ? COLORS.text : COLORS.textMuted, padding: '8px 12px', borderBottom: `2px solid ${tab === t ? GOLD : 'transparent'}`}}>
      {label}
    </button>
  );

  const renderRow = (row: LiveRow) => (
    <div
      key={row.key}
      style={{maxHeight: leaving[row.key] ? 0 : 56, opacity: leaving[row.key] ? 0 : 1, overflow: leaving[row.key] ? 'hidden' : 'visible', transition: 'max-height 0.26s ease, opacity 0.2s ease'}}
      onTransitionEnd={(e) => {
        if (leaving[row.key] && e.propertyName === 'max-height') {
          setRows((r) => r.filter((x) => x.key !== row.key));
          setLeaving((l) => {
            const next = {...l};
            delete next[row.key];
            return next;
          });
        }
      }}>
      <AnimRow
        row={row}
        hovered={hovered === row.key}
        onRowEnter={() => setHovered(row.key)}
        onRowLeave={() => setHovered(null)}
        onPeekEnter={() => setPeekCard(row)}
        onInc={() => changeQty(row.key, 1)}
        onDec={() => changeQty(row.key, -1)}
        onRemove={() => setLeaving((l) => ({...l, [row.key]: true}))}
      />
    </div>
  );

  return (
    <div style={{padding: 32, background: COLORS.background, minHeight: '100vh'}} onMouseLeave={() => setPeekCard(null)}>
      <style>{KEYFRAMES}</style>
      <h2 style={{fontFamily: FONTS.hero, color: COLORS.text, fontSize: FONT_SIZES.xxl, margin: '0 0 4px'}}>Deck panel · shell (tabs)</h2>
      <p style={{fontFamily: FONTS.body, color: COLORS.textMuted, fontSize: FONT_SIZES.base, margin: '0 0 20px', maxWidth: 680}}>
        Cards grouped by type — all five headers always shown. Hover a card's <b>thumbnail or name</b> to preview it in the docked pane on the left. The stepper stays open (± pops, bin removes), <b>+ Add a card</b> slides in. Mixed inks (not a legal deck) — a layout mock. Analysis is reserved for #472.
      </p>
      <div style={{display: 'flex', gap: 24, alignItems: 'flex-start'}}>
        <div style={{width: 250, flexShrink: 0, position: 'sticky', top: 32}}>
          {peekCard ? (
            <CardPreview card={peekCard} width={250} />
          ) : (
            <div style={{width: 250, aspectRatio: '0.72', borderRadius: RADIUS.card, border: `1px dashed ${COLORS.surfaceBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20, color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.base}}>
              Hover a card's art or name to preview it here.
            </div>
          )}
        </div>
        <div style={{width: 700, background: COLORS.surface, border: `1px solid ${COLORS.surfaceBorder}`, borderRadius: RADIUS.card, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
          <div style={{padding: SPACING.md, borderBottom: `1px solid ${COLORS.surfaceBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
            <span style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text}}>New Deck</span>
            <span style={{fontFamily: FONTS.body, fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontWeight: 700}}>{total} / 60</span>
          </div>
          <div style={{display: 'flex', gap: 4, padding: `4px ${SPACING.md}px 0`, borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
            {tabBtn('cards', 'Cards')}
            {tabBtn('analysis', 'Analysis')}
          </div>
          {tab === 'cards' ? (
            <div style={{padding: SPACING.md, display: 'flex', flexDirection: 'column', gap: 2}}>
              <button type="button" onClick={addCard} style={{alignSelf: 'flex-start', marginBottom: SPACING.sm, border: `1px solid ${GOLD}`, background: `${GOLD}18`, color: GOLD, borderRadius: RADIUS.md, padding: '6px 12px', fontFamily: FONTS.body, fontSize: FONT_SIZES.base, fontWeight: 700, cursor: 'pointer'}}>
                + Add a card
              </button>
              {GROUP_ORDER.map((g) => {
                const groupRows = rows
                  .filter((r) => r.type === g)
                  .sort((a, b) => a.cost - b.cost || a.fullName.localeCompare(b.fullName));
                const count = groupRows.reduce((n, r) => n + r.qty, 0);
                return (
                  <div key={g}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: '12px 8px 4px', fontFamily: FONTS.body, fontSize: FONT_SIZES.md, fontWeight: 700, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                      {GROUP_LABEL[g]}
                      <span style={{color: COLORS.textDim, fontWeight: 600}}>{count}</span>
                    </div>
                    {groupRows.length > 0 ? (
                      groupRows.map(renderRow)
                    ) : (
                      <div style={{padding: '2px 8px 8px', color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.base, fontStyle: 'italic'}}>None yet</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <AnalysisPlaceholder />
          )}
        </div>
      </div>
    </div>
  );
}

export const PanelShell: Story = {render: () => <PanelShellDemo />};
