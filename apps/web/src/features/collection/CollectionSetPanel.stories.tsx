import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn, userEvent, within} from 'storybook/test';
import {CollectionSetBody, CollectionSetRail, CollectionSetStrip, type CollectionSetPanelProps} from './CollectionSetPanel';
import {SIDE_PANEL_STYLE} from '../cards/components/BrowseSidePanel';
import type {BinderShow} from './binderCards';
import {
  STORY_PROMO_SET,
  STORY_PROMO_STATS,
  STORY_SETS,
  STORY_SETS_WITH_PROMOS,
  STORY_STATS,
  STORY_STITCH_STATS,
} from './collectionStoryData';
import {tallyCollection} from './collectionStats';
import {COLORS} from '../../shared/constants';

/**
 * The collection panel beside the binder (owner, 2026-10-12): the binder's set picker and
 * All / Owned / Missing on top, the numbers for what the picker shows under them, a set's
 * or, picked first in the picker, the whole collection's. Docked on the binder's right on
 * desktop, at its real size there (260 by 683 in a 1920 by 900 window), in the side
 * panels' surface, which frames it here too. Live: pick a set or the whole collection,
 * choose a headline, or choose what the binder shows. The fixture holds each set in its
 * own way; see `collectionStoryData`.
 */
function LivePanel({layout, ...args}: CollectionSetPanelProps & {layout: 'docked' | 'rail' | 'strip'}) {
  const [setCode, setSetCode] = useState(args.setCode);
  const [show, setShow] = useState<BinderShow>(args.show);
  const props = {...args, setCode, onSetChange: setSetCode, show, onShowChange: setShow};
  if (layout === 'rail') return <CollectionSetRail {...props} />;
  if (layout === 'strip') return <CollectionSetStrip {...props} />;
  return (
    <div style={{...SIDE_PANEL_STYLE, height: 683}}>
      <CollectionSetBody {...props} />
    </div>
  );
}

const meta: Meta<typeof LivePanel> = {
  title: 'Collection/CollectionSetPanel',
  component: LivePanel,
  decorators: [
    (Story) => (
      <div style={{height: 720, padding: 16, background: COLORS.background, display: 'flex'}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {
    layout: 'docked',
    setCode: '13',
    sets: STORY_SETS,
    setsLoading: false,
    onSetChange: fn(),
    show: 'all',
    onShowChange: fn(),
    stats: STORY_STATS,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A set in progress. "Complete set" is chosen, so the breakdowns count toward it. Each bar
 * shows as much of one gold gradient as it reaches, gliding to each new length; switch
 * sets or headlines to watch it.
 */
export const InProgress: Story = {};

/** A headline hovered: its name gives way to its count, "9 of 26 cards", in the same spot. */
export const CountOnHover: Story = {
  play: async ({canvasElement}) => {
    await userEvent.hover(within(canvasElement).getByRole('button', {name: /^Complete set/}));
  },
};

/**
 * A finished set: complete reads 100% in gold, and its breakdowns stay on COMPLETE until
 * "Master set" is chosen. Full bars turn solid gold, glow, and get one pass of light.
 */
export const Finished: Story = {args: {setCode: '12'}};

/** "Master set" chosen: ringed in gold, and the breakdowns count copies held in both finishes. */
export const MasterChosen: Story = {
  args: {setCode: '12'},
  play: async ({canvasElement}) => {
    await userEvent.click(within(canvasElement).getByRole('button', {name: /^Master set/}));
  },
};

/** The whole collection, picked first in the set picker: the same blocks, with every set's numbers summed. */
export const WholeCollection: Story = {args: {setCode: 'all'}};

/**
 * A promo set (owner, 2026-10-17, #805): Complete set and By ink alone, its count in promos.
 * Each pocket holds one printing in one finish, so a master would only repeat Complete.
 */
export const PromoSet: Story = {
  args: {setCode: STORY_PROMO_SET, sets: STORY_SETS_WITH_PROMOS, stats: STORY_PROMO_STATS},
};

/** The whole collection with a promo set in it: one figure, promos and all, and a Promo row under By rarity. */
export const WholeCollectionWithPromos: Story = {
  args: {setCode: 'all', sets: STORY_SETS_WITH_PROMOS, stats: STORY_PROMO_STATS},
};

/**
 * A search for "Stitch" (owner, 2026-10-15): every number counts only the cards it finds,
 * the set picker's percentages too. The headlines lose their noun, since the cards counted
 * are no whole set or collection.
 */
export const Filtered: Story = {args: {setCode: 'all', stats: STORY_STITCH_STATS, filtered: true}};

/** Filters that leave no card: said in words, and the picker shows a dash for every set. */
export const FilteredToNothing: Story = {
  args: {setCode: 'all', stats: tallyCollection([], {}, STORY_SETS), filtered: true},
};

/** While the pool loads: the controls are in, the numbers hold their place. */
export const Loading: Story = {args: {stats: null, sets: ['13'], setsLoading: true}};

/** The collapsed rail, for widths where the open panel would starve the cards. Tap to open over the binder. */
export const Rail: Story = {args: {layout: 'rail'}};

/** Phones: the picker, the headline numbers and what the binder shows in a strip above the page; the tabs open inline. */
export const PhoneStrip: Story = {
  args: {layout: 'strip'},
  decorators: [
    (Story) => (
      <div style={{width: 360}}>
        <Story />
      </div>
    ),
  ],
  globals: {viewport: {value: 'mobile1'}},
};
