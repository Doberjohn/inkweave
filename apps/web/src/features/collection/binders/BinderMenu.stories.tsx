import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn, userEvent, within} from 'storybook/test';
import {BinderMenu} from './BinderMenu';

/**
 * A cover's ⋯ on the shelf, open. A binder of your own's: Open, Edit rules, Rename, Change cover,
 * Move earlier and later, and Delete binder, which asks first. The first binder has no Move
 * earlier, the last no Move later. My collection's: Open, Change cover and Change page size.
 */
const meta: Meta<typeof BinderMenu> = {
  title: 'Collection/Binders/BinderMenu',
  component: BinderMenu,
  decorators: [
    (Story) => (
      <div style={{display: 'flex', justifyContent: 'flex-end', width: 220, padding: 16, minHeight: 340}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {
    alwaysShown: true,
    onOpen: fn(),
    onEditRules: fn(),
    onRename: fn(),
    onChangeCover: fn(),
    moves: {first: false, last: false, onMove: fn()},
    onDelete: fn(),
  },
  play: async ({canvasElement}) => {
    await userEvent.click(within(canvasElement).getByRole('button', {name: 'Actions'}));
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A binder in the middle of the shelf: every item. */
export const Middle: Story = {};

/** The first binder: no Move earlier. */
export const First: Story = {args: {moves: {first: true, last: false, onMove: fn()}}};

/** The last binder: no Move later. */
export const Last: Story = {args: {moves: {first: false, last: true, onMove: fn()}}};

/**
 * My collection's: Open, Change cover and Change page size, since it never moves and can't be
 * deleted, and has no window to hold its size.
 */
export const MyCollection: Story = {
  args: {onEditRules: undefined, onRename: undefined, onChangePages: fn(), moves: undefined, onDelete: undefined},
};

/** Closed: the dark disc over a cover's art. */
export const Closed: Story = {play: async () => {}};
