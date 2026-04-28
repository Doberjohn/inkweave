import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {MechanicsButton} from './MechanicsButton';

const meta: Meta<typeof MechanicsButton> = {
  title: 'Synergies/MechanicsButton',
  component: MechanicsButton,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  args: {
    onClick: fn(),
    activeCount: 0,
    isMobile: false,
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Active: Story = {
  args: {activeCount: 2},
};

export const Mobile: Story = {
  args: {isMobile: true},
};

export const MobileActive: Story = {
  args: {isMobile: true, activeCount: 3},
};
