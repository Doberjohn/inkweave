import {useState, type CSSProperties} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {PrintingCarousel} from './PrintingCarousel';
import {COLORS, SPACING} from '../constants';
import {usePrintingSelection} from '../hooks';

const meta: Meta<typeof PrintingCarousel> = {
  title: 'Shared/PrintingCarousel',
  component: PrintingCarousel,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Beast - Gracious Prince: Standard, Enchanted and a promo, so the middle printing has a neighbour
// on each side. Its art is self-hosted as `pnpm download-images` names it: Storybook serves
// public/, without the dev server's proxy.
const beast: LorcanaCard = {
  id: '1940',
  name: 'Beast',
  version: 'Gracious Prince',
  fullName: 'Beast - Gracious Prince',
  cost: 5,
  ink: 'Amber',
  inkwell: true,
  type: 'Character',
  setCode: '9',
  imageUrl: '/card-images/1940.369b3e8a0cc8e575.avif',
  variants: [
    {
      id: '2142',
      rarity: 'Enchanted',
      number: 224,
      imageUrl: '/card-images/2142.2091644fa9899923.avif',
    },
    {
      id: '2461',
      rarity: 'Special',
      number: 40,
      promoGrouping: 'P3',
      imageUrl: '/card-images/2461.a3f9c102b6e23242.avif',
    },
  ],
};

/** Beast with its Enchanted printing alone: round the loop, it sits behind both of the card's sides. */
const beastAndEnchanted: LorcanaCard = {...beast, variants: beast.variants?.slice(0, 1)};

/** The frame around the card: its padding, the room the printings behind it show in, and clipped at its edge. */
function frameStyle(padding: number): CSSProperties {
  return {padding, overflow: 'hidden', background: COLORS.surface};
}

interface DemoProps {
  card?: LorcanaCard;
  width: number;
  height: number;
  /** The padding of the frame around the card: the window's 24px, the card page panel's 16. */
  frame?: number;
  /** The card page's hero: each printing enlarges. */
  enlarges?: boolean;
  locked?: boolean;
}

/** Wired as every surface wires it: the printing in front, and the views it records. */
function Demo({card = beast, width, height, frame, enlarges = false, locked}: DemoProps) {
  const {printings, index, select, settle} = usePrintingSelection(card, {surface: 'card_page'});
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const carousel = (
    <PrintingCarousel
      card={card}
      printings={printings}
      index={index}
      onIndexChange={select}
      onSettle={settle}
      locked={locked}
      onEnlarge={enlarges ? (i) => setEnlarged(printings[i].label) : undefined}
      room={frame}
      width={width}
      height={height}
      priority
    />
  );
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.md}}>
      {frame === undefined ? carousel : <div style={frameStyle(frame)}>{carousel}</div>}
      {enlarged && <span style={{color: COLORS.text}}>Enlarge: {enlarged}</span>}
    </div>
  );
}

// The card window's card, in the window's 24px of padding. The printings before and after it
// sit behind it, fanned out past its sides from its foot. Under a mouse, rest near a side and
// that printing leans further out: a click there turns to it. Drag the card aside and let go,
// or swipe across it on a trackpad; with the card focused, ← and → turn it. The turns loop:
// after the promo comes the Standard, and before the Standard the promo.
export const Window: Story = {
  render: () => <Demo width={337} height={470} frame={SPACING.xxl} />,
};

// A card with two printings: the other one sits behind both of the card's sides, and comes in
// from whichever side the card is turned to.
export const TwoPrintings: Story = {
  render: () => <Demo card={beastAndEnchanted} width={337} height={470} frame={SPACING.xxl} />,
};

// The card page's hero, in the panel's 16px of padding, where the peek slides out and leans
// less to fit: a click on the middle of the art enlarges that printing.
export const CardPage: Story = {
  render: () => <Demo width={298} height={417} frame={SPACING.lg} enlarges />,
};

// A phone's window. On a touch screen the printings' edges show wider at rest: a swipe throws
// the card aside, and a tap on an edge turns to that printing.
export const Phone: Story = {
  render: () => <Demo width={240} height={335} />,
  globals: {viewport: {value: 'mobile1'}},
};

// A comparison shows the base art: the card holds still, with nothing behind it.
export const Locked: Story = {
  render: () => <Demo width={337} height={470} frame={SPACING.xxl} locked />,
};
