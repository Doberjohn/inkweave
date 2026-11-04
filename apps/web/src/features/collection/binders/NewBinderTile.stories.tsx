import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {NewBinderTile, ShelfFullLine} from './NewBinderTile';

/**
 * New binder, after the shelf's last cover (#1075): a cover's board in a dashed outline that
 * turns gold on hover and focus, and what a binder keeps. It opens the New binder window. Drawn
 * at a computer shelf's narrowest column.
 */
const meta: Meta<typeof NewBinderTile> = {
  title: 'Collection/Binders/NewBinderTile',
  component: NewBinderTile,
  decorators: [
    (Story) => (
      <div style={{width: 200}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onNew: fn(), compact: false},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A phone's two-across shelf: the board and its words, without the hint. */
export const Compact: Story = {args: {compact: true}, globals: {viewport: {value: 'mobile1'}}};

/** A shelf of thirty: the line that stands in New binder's place. */
export const ShelfFull: Story = {render: () => <ShelfFullLine />};
