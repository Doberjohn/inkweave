import type {Meta, StoryObj} from '@storybook/react-vite';
import {SynergyResultsSkeleton} from './SynergyResultsSkeleton';

const meta: Meta<typeof SynergyResultsSkeleton> = {
  title: 'Features/SynergyResultsSkeleton',
  component: SynergyResultsSkeleton,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          "The card page's synergy column while the card's synergies load: the header, toolbar and two groups of card tiles, in place of a premature \"No synergies found\".",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: {isMobile: false},
};

export const Mobile: Story = {
  args: {isMobile: true},
  globals: {viewport: {value: 'mobile1'}},
};
