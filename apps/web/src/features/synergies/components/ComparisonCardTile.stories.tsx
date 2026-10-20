import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {ComparisonCardTile} from './ComparisonCardTile';
import {createCard} from '../../../shared/test-utils/factories';
import {COLORS, RADIUS} from '../../../shared/constants';

const miguel = createCard({
  id: '3286',
  name: 'Miguel Rivera',
  fullName: 'Miguel Rivera - Street Musician',
  ink: 'Amber',
  imageUrl: '/card-images/en/set14/21_048bc928fcdbc95404769432d10b5e82c68246c7.jpg',
});

const judy = createCard({
  id: '2326',
  name: 'Judy Hopps',
  fullName: 'Judy Hopps - On the Case',
  ink: 'Sapphire',
  imageUrl: '/card-images/en/set10/137_30d8cb2cb3712386a7bc680212e469af140f807e.jpg',
});

const meta = {
  title: 'Synergies/ComparisonCardTile',
  component: ComparisonCardTile,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // Half of the phone comparison's cards row, which sizes each tile.
      <div
        style={{
          width: 336,
          display: 'flex',
          justifyContent: 'center',
          padding: 16,
          background: COLORS.surface,
          borderRadius: RADIUS.card,
        }}>
        <Story />
      </div>
    ),
  ],
  args: {card: miguel, which: 'a', onTap: fn()},
} satisfies Meta<typeof ComparisonCardTile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The frame takes the card's ink: Amber. */
export const Amber: Story = {};

/** Sapphire. */
export const Sapphire: Story = {
  args: {card: judy, which: 'b'},
};
