import type {Meta, StoryObj} from '@storybook/react-vite';
import {LoadingSpinner} from './LoadingSpinner';

const meta: Meta<typeof LoadingSpinner> = {
  title: 'Components/LoadingSpinner',
  component: LoadingSpinner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const CustomMessage: Story = {
  args: {
    message: 'Calculating synergies...',
  },
};

export const LoadingDeck: Story = {
  args: {
    message: 'Loading your saved decks...',
  },
};
