import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {BinderCover, CoverSkeleton} from './BinderCover';
import {BinderMenu} from './BinderMenu';
import {STORY_BINDER_POOL} from './binderStoryData';

/**
 * One binder on the shelf (#1074): the board holding its cover card, its name and rules on the
 * plate, and under it the Complete percentage, the count and the gold bar. The whole cover links
 * to the binder; hover or focus rings it in gold.
 */
const meta: Meta<typeof BinderCover> = {
  title: 'Collection/Binders/BinderCover',
  component: BinderCover,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{width: 220, padding: 24}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  tags: ['autodocs'],
  args: {
    name: 'Amber',
    rule: 'Amber ink',
    cover: STORY_BINDER_POOL[0],
    figures: {complete: 293, master: 120, cards: 625},
    promos: false,
    to: '/browse?binder=all',
    onOpen: fn(),
    compact: false,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A binder of your own, its ⋯ at the top right, shown here as hover shows it. */
export const WithActions: Story = {
  args: {
    actions: <BinderMenu first={false} last={false} alwaysShown onOpen={fn()} onMove={fn()} onDelete={fn()} />,
  },
};

/** My collection: no ⋯ on the shelf. */
export const MyCollection: Story = {
  args: {name: 'My collection', rule: 'Every card', figures: {complete: 1704, master: 900, cards: 3500}},
};

/** Rules that hold none of your cards: an empty sleeve. */
export const EmptySleeve: Story = {args: {cover: null, figures: {complete: 0, master: 0, cards: 140}}};

/** A binder of promo sets alone counts promos. */
export const PromoBinder: Story = {
  args: {name: 'Promos', rule: 'All promo sets', cover: null, figures: {complete: 2, master: 1, cards: 16}, promos: true},
};

/** Thirty letters, the longest a name runs, and a long rule line: both cut short on the plate. */
export const LongName: Story = {
  args: {name: 'Shimmering Sapphire Collection', rule: 'Sapphire ink · Super Rare, Legendary · Set 12'},
};

/** A phone's short count. */
export const Compact: Story = {args: {compact: true}};

/** A binder whose move failed: the line under its numbers. */
export const MoveFailed: Story = {args: {note: "Couldn't move it. Try again."}};

/** A cover still to come: the shimmer the shelf draws in its place, exactly its size. */
export const Skeleton: Story = {render: () => <CoverSkeleton />};
