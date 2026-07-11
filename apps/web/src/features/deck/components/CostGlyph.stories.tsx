import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../../../shared/constants';
import {CostGlyph} from './CostGlyph';

const meta: Meta<typeof CostGlyph> = {
  title: 'Deck/CostGlyph',
  component: CostGlyph,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, padding: 40, display: 'flex', gap: 12}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Inkable: Story = {args: {cost: 3, inkwell: true}};

export const Uninkable: Story = {args: {cost: 4, inkwell: false}};

// Cost >= 9 collapses to "9+" (real cards cap the inkwell number at 9).
export const HighCost: Story = {args: {cost: 9, inkwell: true}};
