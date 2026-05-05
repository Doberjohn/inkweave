import type {Meta, StoryObj} from '@storybook/react-vite';
import {AbilityCallout} from './AbilityCallout';
import {AbilityTag} from './AbilityTag';

const meta: Meta<typeof AbilityCallout> = {
  title: 'Components/AbilityCallout',
  component: AbilityCallout,
  parameters: {layout: 'centered', backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AbilityCallout>;

export const Standalone: Story = {
  args: {
    variant: 'standalone',
    children:
      'Speed up your ink so you can play powerful cards earlier than your opponent. Stack inkwell ramp, triggers, and cost reduction for turns where you play far above your ink count.',
  },
  parameters: {layout: 'padded'},
};

export const StackedAfterTag: Story = {
  args: {
    variant: 'stacked-after-tag',
    children:
      'Speed up your ink so you can play powerful cards earlier than your opponent.',
  },
  render: (args) => (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: 480}}>
      <AbilityTag variant="stacked">Ramp</AbilityTag>
      <div style={{alignSelf: 'stretch'}}>
        <AbilityCallout {...args} />
      </div>
    </div>
  ),
};
