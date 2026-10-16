import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {ToolbarToggle} from './ToolbarToggle';

/**
 * The toolbar's two-state toggle (Browse's Filters and Collection): filled gold with a
 * warm glow while its area is open, the ghost outline while it is closed.
 */
const meta = {
  title: 'Components/ToolbarToggle',
  component: ToolbarToggle,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  args: {onClick: fn(), children: 'Collection', active: true},
} satisfies Meta<typeof ToolbarToggle>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Its area is open. */
export const Active: Story = {};

/** Its area is closed. */
export const Inactive: Story = {args: {active: false}};

/** Both states side by side, as the toolbar shows them with the filters open and collection mode off. */
export const BothStates: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 10}}>
      <ToolbarToggle active onClick={fn()}>
        Filters
      </ToolbarToggle>
      <ToolbarToggle active={false} onClick={fn()}>
        Collection
      </ToolbarToggle>
    </div>
  ),
};
