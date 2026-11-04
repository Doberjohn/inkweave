import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {COLORS} from '../../../shared/constants';
import {BinderShelf} from './BinderShelf';
import {STORY_BINDER_ENTRIES, STORY_BINDER_POOL, storyShelf} from './binderStoryData';

/**
 * The binder shelf (#1074): My collection, then your binders in place order, each a closed zip
 * binder holding its cover card, its name on the plate, and how complete it is under it. Hover
 * or focus a binder of your own for its ⋯ (always shown on a phone). The heading, "Your binders"
 * and the count, stands in the toolbar (`ShelfHeading`).
 */
const meta: Meta<typeof BinderShelf> = {
  title: 'Collection/Binders/BinderShelf',
  component: BinderShelf,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/browse?binder=shelf']}>
        <div style={{height: 720, background: COLORS.background}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {shelf: storyShelf(), pool: STORY_BINDER_POOL, entries: STORY_BINDER_ENTRIES, waiting: false, readerId: 'story-reader'},
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Seven covers: My collection and six binders. Binders whose rules hold none of your cards show
 * an empty sleeve; the thirty-letter name is cut short on its plate.
 */
export const SevenBinders: Story = {};

/** No binder of your own yet: My collection alone. */
export const OnlyMyCollection: Story = {args: {shelf: storyShelf({binders: []})}};

/** While the cards or your copy load: My collection's cover is a shimmer its size. */
export const Loading: Story = {args: {shelf: storyShelf({status: 'loading', binders: []}), pool: null}};

/** Your binders didn't load: My collection, and a line with its Try again. */
export const Failed: Story = {args: {shelf: storyShelf({status: 'failed', binders: [], retry: fn()})}};

/** A phone: two across, each binder's ⋯ always shown, the counts in their short form. */
export const PhoneSevenBinders: Story = {globals: {viewport: {value: 'mobile1'}}};

/** A phone with no binder yet. */
export const PhoneOnlyMyCollection: Story = {...OnlyMyCollection, globals: {viewport: {value: 'mobile1'}}};

/** A phone while the cards load. */
export const PhoneLoading: Story = {...Loading, globals: {viewport: {value: 'mobile1'}}};

/** A phone after a failed read. */
export const PhoneFailed: Story = {...Failed, globals: {viewport: {value: 'mobile1'}}};
