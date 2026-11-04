import type {Meta, StoryObj} from '@storybook/react-vite';
import {ShelfHeading} from './ShelfHeading';

/**
 * The shelf's heading (#1074), where the toolbar's filters stand: "Your binders" and how many,
 * My collection included. The count joins once the binders have loaded.
 */
const meta: Meta<typeof ShelfHeading> = {
  title: 'Collection/Binders/ShelfHeading',
  component: ShelfHeading,
  tags: ['autodocs'],
  args: {count: 7},
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** My collection alone. */
export const OneBinder: Story = {args: {count: 1}};

/** While the binders load: the words alone. */
export const Loading: Story = {args: {count: null}};

/** A phone's row: a step smaller, the count a bare number. */
export const Compact: Story = {args: {compact: true}};
