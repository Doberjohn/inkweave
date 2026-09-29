import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {PrintingCarousel} from './PrintingCarousel';
import {PrintingPills} from './PrintingPills';
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

const mickey: LorcanaCard = {
  id: '14023',
  name: 'Mickey Mouse',
  version: 'Best in Town',
  fullName: 'Mickey Mouse - Best in Town',
  cost: 1,
  ink: 'Amber',
  inkwell: true,
  type: 'Character',
  setCode: '14',
  imageUrl: '/card-images-preview/14023.avif',
  variants: [
    {
      id: '14241',
      rarity: 'Iconic',
      number: 241,
      imageUrl: '/card-images/en/set14/241_bcae8ffa04289d85442a384f9982570a224f61ba.jpg',
    },
  ],
};

/** The pairing every surface uses: the swipeable strip, with the pills as its indicator. */
function Demo({card}: {card: LorcanaCard}) {
  const {printings, index, select} = usePrintingSelection(card);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.md}}>
      <PrintingCarousel
        card={card}
        printings={printings}
        index={index}
        onIndexChange={select}
        onEnlarge={(i) => setEnlarged(printings[i].label)}
        width={298}
        height={417}
        priority
      />
      <PrintingPills printings={printings} index={index} onSelect={select} />
      {enlarged && <span style={{color: COLORS.text}}>Enlarge: {enlarged}</span>}
    </div>
  );
}

// Swipe the art (touch or trackpad) or use the pills: both move the same selection.
export const WithIconic: Story = {
  render: () => <Demo card={mickey} />,
};
