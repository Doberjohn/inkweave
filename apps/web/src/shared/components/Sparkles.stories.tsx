import type {Meta, StoryObj} from '@storybook/react-vite';
import {Sparkles} from './Sparkles';

const meta = {
  title: 'Shared/Sparkles',
  component: Sparkles,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{background: '#1a1a2e', padding: 48, borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sparkles>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Gold: Story = {
  args: {
    color: '#ffd700',
    children: <span style={{color: '#d4af37', fontSize: 20, fontWeight: 700}}>Sparkly Text</span>,
  },
};

export const Green: Story = {
  args: {
    color: '#6ee7a0',
    children: <span style={{color: '#6ee7a0', fontSize: 20, fontWeight: 700}}>Complete!</span>,
  },
};

export const FastRate: Story = {
  args: {
    color: '#ffd700',
    rate: 150,
    maxSize: 14,
    children: <span style={{color: '#ffb900', fontSize: 20, fontWeight: 700}}>Celebration</span>,
  },
};

export const AroundProgressBar: Story = {
  args: {
    color: '#ffd700',
    minSize: 3,
    maxSize: 8,
    rate: 500,
    children: (
      <div style={{width: 300, height: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)'}}>
        <div style={{width: '66%', height: '100%', background: 'linear-gradient(90deg, #b8860b, #d4af37, #ffb900)', borderRadius: 4}} />
      </div>
    ),
  },
};
