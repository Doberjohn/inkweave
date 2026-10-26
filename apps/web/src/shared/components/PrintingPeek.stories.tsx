import {useState, type ReactNode} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardImage} from './CardImage';
import {CtaButton} from 'inkweave-ui/components/CtaButton';
import {TurnNotice} from './PrintingPeek';
import {RADIUS, SPACING} from '../constants';
import type {Printing} from 'inkweave-ui/lib/printings';

const meta: Meta<typeof TurnNotice> = {
  title: 'Shared/PrintingPeek',
  component: TurnNotice,
  parameters: {layout: 'centered'},
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The card window's card on desktop. */
const WIDTH = 337;
const HEIGHT = 470;

const enchanted: Printing = {key: '2142', label: 'Enchanted', rarity: 'Enchanted', number: 224};

/** Beast - Gracious Prince's Enchanted art, self-hosted as `pnpm download-images` names it. */
function Card({children}: {children: ReactNode}) {
  return (
    <div style={{position: 'relative', width: WIDTH, height: HEIGHT}}>
      <CardImage
        src="/card-images/2142.2091644fa9899923.avif"
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

/** Counts the turns, as the stack does, so the notice can be played again. */
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
