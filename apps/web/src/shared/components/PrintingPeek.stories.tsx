import {useState, type ReactNode} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardImage} from './CardImage';
import {CtaButton} from './CtaButton';
import {PeekTag, TurnNotice} from './PrintingPeek';
import {RADIUS, SPACING} from '../constants';
import type {Printing} from '../hooks/usePrintingSelection';

const meta: Meta<typeof PeekTag> = {
  title: 'Shared/PrintingPeek',
  component: PeekTag,
  parameters: {layout: 'centered'},
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The card window's card on desktop. */
const WIDTH = 337;
const HEIGHT = 470;

const standard: Printing = {key: 'standard', label: 'Standard'};
const enchanted: Printing = {key: '2142', label: 'Enchanted', rarity: 'Enchanted', number: 224};
const promo: Printing = {key: '2461', label: '40/P3', rarity: 'Special', number: 40, promoGrouping: 'P3'};

/** Beast - Gracious Prince's Enchanted art, which dev proxies to Ravensburger's (vite.config.ts). */
function Card({children}: {children: ReactNode}) {
  return (
    <div style={{position: 'relative', width: WIDTH, height: HEIGHT}}>
      <CardImage
        src="/card-images/en/set9/224_7f17c04013ed08ca46ff1a029608cc2fb8c5a3cb.jpg"
        alt="Beast - Gracious Prince, Enchanted printing"
        width={WIDTH}
        height={HEIGHT}
        inkColor="Amber"
        cost={5}
        borderRadius={RADIUS.xl}
      />
      {children}
    </div>
  );
}

// A pointer near the card's left side: the peek opens there, named for the printing a click turns to.
export const PreviousPeek: Story = {
  render: () => (
    <Card>
      <PeekTag side="prev" printing={standard} y={180} height={HEIGHT} />
    </Card>
  ),
};

// And near its right side, a promo by the code printed on it.
export const NextPeek: Story = {
  render: () => (
    <Card>
      <PeekTag side="next" printing={promo} y={300} height={HEIGHT} />
    </Card>
  ),
};

/** Counts the turns, as the strip does, so the notice can be played again. */
function Turns() {
  const [turns, setTurns] = useState(1);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.lg}}>
      <Card>
        <TurnNotice printing={enchanted} position={2} count={3} turns={turns} />
      </Card>
      <CtaButton variant="neutral" onClick={() => setTurns((n) => n + 1)}>
        Turn again
      </CtaButton>
    </div>
  );
}

// After each turn the visitor makes, the printing it brought in is named on the card for a moment,
// and once for a screen reader.
export const TurnNoticeAfterATurn: Story = {
  render: () => <Turns />,
};
