import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CollectionCopies} from './CollectionCopies';
import {COLORS} from '../../shared/constants';

/**
 * The card window's "Your copies" (#826): a − count + per finish for the printing on show.
 * The frame stands in for the desktop card column it sits under, 337px wide; on a phone it
 * fills the column under the card the same way.
 */
const meta: Meta<typeof CollectionCopies> = {
  title: 'Collection/CollectionCopies',
  component: CollectionCopies,
  decorators: [
    (Story) => (
      <div style={{width: 337, padding: 16, background: COLORS.surface}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {counts: {normal: 2, foil: 1}, cardName: 'Elsa - Snow Queen', onChange: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Both finishes held: Normal on the dark ground, Foil on brushed gold. */
export const BothFinishes: Story = {};

/** An Enchanted printing, made only in foil: the Normal row gives way to a line that says so. */
export const FoilOnly: Story = {args: {counts: {normal: 0, foil: 1}, foilOnly: 'Enchanted'}};

/** None held yet: both counts at 0, their − greyed, so a first copy is one click on its +. */
export const AtZero: Story = {args: {counts: {normal: 0, foil: 0}}};
