import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn, userEvent, within} from 'storybook/test';
import {BinderMenu} from './BinderMenu';

/**
 * A binder of your own's ⋯ on the shelf (#1074), open: Open, Move earlier and later, and
 * Delete binder, which asks first. The first binder has no Move earlier, the last no Move later.
 */
const meta: Meta<typeof BinderMenu> = {
  title: 'Collection/Binders/BinderMenu',
  component: BinderMenu,
  decorators: [
    (Story) => (
      <div style={{display: 'flex', justifyContent: 'flex-end', width: 220, padding: 16, minHeight: 240}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {first: false, last: false, alwaysShown: true, onOpen: fn(), onMove: fn(), onDelete: fn()},
  play: async ({canvasElement}) => {
    await userEvent.click(within(canvasElement).getByRole('button', {name: 'Actions'}));
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A binder in the middle of the shelf: every item. */
export const Middle: Story = {};

/** The first binder: no Move earlier. */
export const First: Story = {args: {first: true}};

/** The last binder: no Move later. */
export const Last: Story = {args: {last: true}};

/** Closed: the dark disc over a cover's art. */
export const Closed: Story = {play: async () => {}};
