import type {Meta, StoryObj} from '@storybook/react-vite';
import {EmptyState} from './EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'No cards found',
  },
};

export const WithSubtitle: Story = {
  args: {
    title: 'No results',
    subtitle: 'Try adjusting your search or filters',
  },
};

export const WithCustomIcon: Story = {
  args: {
    title: 'Select a card',
    subtitle: 'Click on a card to see its synergies',
    icon: <span style={{fontSize: '48px'}}>🎴</span>,
  },
};

export const NoSynergies: Story = {
  args: {
    title: 'No synergies found',
    subtitle: 'This card has no detected synergies with other cards',
    icon: <span style={{fontSize: '48px'}}>🔍</span>,
  },
};

export const EmptyDeck: Story = {
  args: {
    title: 'Your deck is empty',
    subtitle: 'Add cards from the card list to get started',
    icon: <span style={{fontSize: '48px'}}>📚</span>,
  },
};
