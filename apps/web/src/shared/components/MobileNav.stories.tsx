import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {MobileNav} from './MobileNav';

const meta: Meta<typeof MobileNav> = {
  title: 'Components/MobileNav',
  component: MobileNav,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  tags: ['autodocs'],
  args: {
    onViewChange: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{position: 'fixed', bottom: 0, left: 0, right: 0}}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const CardsActive: Story = {
  args: {
    activeView: 'cards',
  },
};

export const SynergiesActive: Story = {
  args: {
    activeView: 'synergies',
  },
};
