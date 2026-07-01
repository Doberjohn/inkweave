import type {Meta, StoryObj} from '@storybook/react-vite';
import {SpotlightHero} from './SpotlightHero';
import {SET_SPOTLIGHTS} from './setSpotlights';

const vinelings = SET_SPOTLIGHTS[0].items.find((s) => s.id === 'vinelings')!;

const meta: Meta<typeof SpotlightHero> = {
  title: 'Features/Reveals/SpotlightHero',
  component: SpotlightHero,
  parameters: {backgrounds: {default: 'dark'}, layout: 'padded'},
  tags: ['autodocs'],
  args: {data: vinelings},
  decorators: [
    (Story) => (
      <div style={{maxWidth: 880, margin: '0 auto'}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  args: {compact: true},
  decorators: [
    (Story) => (
      <div style={{maxWidth: 390, margin: '0 auto'}}>
        <Story />
      </div>
    ),
  ],
};
