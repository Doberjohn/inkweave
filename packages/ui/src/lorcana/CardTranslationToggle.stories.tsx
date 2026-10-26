import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CardTranslationToggle} from './CardTranslationToggle';

const meta: Meta<typeof CardTranslationToggle> = {
  title: 'Shared/CardTranslationToggle',
  component: CardTranslationToggle,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  args: {onToggle: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

// A foreign-language scan (#623): the switch between the scan and its English translation.
export const ShowingScan: Story = {
  args: {shown: false},
};

export const ShowingTranslation: Story = {
  args: {shown: true},
};
