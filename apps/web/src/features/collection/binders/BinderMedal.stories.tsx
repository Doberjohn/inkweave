import type {Meta, StoryObj} from '@storybook/react-vite';
import {BinderMedal} from './BinderMedal';
import {STORY_BINDER_POOL} from './binderStoryData';

/**
 * A binder's medal: a round crop of its cover card's art, the face at the top of the
 * card, inside a dark and a faint light rim. The set picker draws it at 24px in the Binders tab's
 * rows, 18px in the toolbar's button, and up to 36px in the panel's.
 */
const meta: Meta<typeof BinderMedal> = {
  title: 'Collection/Binders/BinderMedal',
  component: BinderMedal,
  tags: ['autodocs'],
  args: {card: STORY_BINDER_POOL[0], size: 24},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A row's medal, 24px. */
export const Row: Story = {};

/** The panel's button's, 36px. */
export const Panel: Story = {args: {size: 36}};

/** A binder that holds none of your cards yet: an empty ring. */
export const NoCover: Story = {args: {card: null}};
