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
// on each side. Dev proxies the art to Ravensburger's (vite.config.ts).
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
  imageUrl: '/card-images/en/set9/4_ba9aa6fc55449cefeb4afcc19c1a9e0e80b6fbc1.jpg',
  variants: [
    {
      id: '2142',
      rarity: 'Enchanted',
      number: 224,
      imageUrl: '/card-images/en/set9/224_7f17c04013ed08ca46ff1a029608cc2fb8c5a3cb.jpg',
    },
    {
      id: '2461',
      rarity: 'Special',
      number: 40,
      promoGrouping: 'P3',
      imageUrl: '/card-images/en/promo3/40_4aaa4b5c9966aebb9625e996be936aca338989df.jpg',
    },
  ],
};

/** The frame around the card: its padding, the room the printings behind it show in, and clipped at its edge. */
function frameStyle(padding: number): CSSProperties {
  return {padding, overflow: 'hidden', background: COLORS.surface};
}

interface DemoProps {
  width: number;
  height: number;
  /** The padding of the frame around the card: the window's 24px, the card page panel's 16. */
  frame?: number;
  /** The card page's hero: each printing enlarges. */
  enlarges?: boolean;
  locked?: boolean;
}

/** Wired as every surface wires it: the printing in front, and the views it records. */
function Demo({width, height, frame, enlarges = false, locked}: DemoProps) {
  const {printings, index, select, settle} = usePrintingSelection(beast, {surface: 'card_page'});
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const carousel = (
    <PrintingCarousel
      card={beast}
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
// sit behind it, their edges showing past its sides. Under a mouse, rest near a side and that
// printing leans out from behind the card, named: a click there turns to it. Drag the card
// aside and let go, or swipe across it on a trackpad; with the card focused, ← and → turn it.
export const Window: Story = {
  render: () => <Demo width={337} height={470} frame={SPACING.xxl} />,
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
