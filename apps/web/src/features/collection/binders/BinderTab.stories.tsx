import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {BinderList} from './BinderTab';
import {SIDE_PANEL_WIDTH} from '../../cards/components/BrowseSidePanel';
import {COLORS, RADIUS, SPACING} from '../../../shared/constants';
import {STORY_OPEN_AMBER, storyBinderChoices} from './binderStoryData';

/**
 * The set picker's Binders tab (#1074, 3A): My collection, then your binders in shelf order,
 * each with its cover's medal, its name and how complete it is, the open one ringed in gold.
 * Drawn here on the menu's surface, at a side panel's width; `SetPicker`'s stories show it in
 * the menu.
 */
const meta: Meta<typeof BinderList> = {
  title: 'Collection/Binders/BinderTab',
  component: BinderList,
  decorators: [
    (Story) => (
      <div
        style={{
          width: SIDE_PANEL_WIDTH,
          padding: SPACING.xs,
          background: COLORS.surfaceFloating,
          border: `1px solid ${COLORS.surfaceBorder}`,
          borderRadius: `${RADIUS.lg}px`,
        }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {choices: storyBinderChoices({onOpen: fn()}), onPicked: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * My collection on show. The last binder's thirty-letter name is cut short, and its rules hold
 * none of your cards: an empty ring and a dash.
 */
export const Shelf: Story = {};

/** A binder of your own on show, ringed in gold. */
export const BinderOpen: Story = {args: {choices: storyBinderChoices({open: STORY_OPEN_AMBER, onOpen: fn()})}};

/** While the pool loads: no covers or percentages yet. */
export const PoolLoading: Story = {args: {choices: storyBinderChoices({pool: null, onOpen: fn()})}};

/** While your binders load: a row's shimmer under My collection. */
export const ShelfLoading: Story = {
  args: {choices: storyBinderChoices({shelf: {status: 'loading', binders: [], retry: fn()}, onOpen: fn()})},
};

/** Your binders didn't load: a line and its Try again. */
export const ShelfFailed: Story = {
  args: {choices: storyBinderChoices({shelf: {status: 'failed', binders: [], retry: fn()}, onOpen: fn()})},
};
