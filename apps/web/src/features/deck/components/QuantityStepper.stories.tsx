import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS} from '../../../shared/constants';
import {QuantityStepper} from './QuantityStepper';

const meta: Meta<typeof QuantityStepper> = {
  title: 'Deck/QuantityStepper',
  component: QuantityStepper,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, padding: 40}}>
        <Story />
      </div>
    ),
  ],
  args: {onIncrement: fn(), onDecrement: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {args: {value: 2, label: 'Pocahontas'}};

export const Small: Story = {args: {value: 2, size: 'sm', label: 'Pocahontas'}};

export const Collapsed: Story = {args: {value: 2, collapsed: true, label: 'Pocahontas'}};

export const AtMax: Story = {args: {value: 4, incrementDisabled: true, disabledReason: 'Maximum 4 copies', label: 'Pocahontas'}};
