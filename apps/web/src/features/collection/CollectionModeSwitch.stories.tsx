import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CollectionModeSwitch} from './CollectionModeSwitch';

/** Collection mode's toolbar toggle, as it sits beside Filters. */
const meta: Meta<typeof CollectionModeSwitch> = {
  title: 'Collection/CollectionModeSwitch',
  component: CollectionModeSwitch,
  decorators: [
    (Story) => (
      <div style={{display: 'flex', alignItems: 'center', gap: 8, padding: 16}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {active: false, onToggle: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Off: the ghost toggle. */
export const Off: Story = {};

/** On: the gold selection glow. */
export const On: Story = {args: {active: true}};
