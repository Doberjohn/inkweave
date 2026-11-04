import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {fn, userEvent, within} from 'storybook/test';
import type {CollectionEntries} from '../collectionParser';
import {CoverPicker} from './CoverPicker';
import {STORY_AMBER, STORY_BINDER_ENTRIES, STORY_BINDER_POOL} from './binderStoryData';

/**
 * Change cover, from a cover's ⋯: "The rarest card you have", then the cards the binder holds that
 * you have, rarest first, 40 at a time, which Find a card narrows by name. A pick saves at once,
 * and saves reach the server, so these stories never pick; its unit tests hold the saving and
 * failure states. A dialog on a computer, a sheet on a phone.
 */
const meta: Meta<typeof CoverPicker> = {
  title: 'Collection/Binders/CoverPicker',
  component: CoverPicker,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    binder: STORY_AMBER,
    shelfCover: null,
    pool: STORY_BINDER_POOL,
    entries: STORY_BINDER_ENTRIES,
    readerId: 'story-reader',
    isMobile: false,
    onSaved: fn(),
    onClose: fn(),
    onGone: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The previews' art, by turns, for a collection big enough to page. */
const ART = ['14085', '14213', '14014', '14023'];

/** Fifty Amber cards, every one held: the first 40 show, then Show more. */
const BIG_POOL: LorcanaCard[] = Array.from(
  {length: 50},
  (_, at) =>
    ({
      id: `amber-${at}`,
      name: at % 2 === 0 ? 'Elsa' : 'Moana',
      fullName: `${at % 2 === 0 ? 'Elsa' : 'Moana'} - Card ${at + 1}`,
      cost: 2,
      inkwell: true,
      type: 'Character',
      ink: 'Amber',
      rarity: ['Legendary', 'Super Rare', 'Rare', 'Uncommon'][at % 4],
      setCode: '14',
      setNumber: at + 1,
      imageUrl: `/card-images-preview/${ART[at % ART.length]}.avif`,
    }) as LorcanaCard,
);

const BIG_ENTRIES: CollectionEntries = Object.fromEntries(BIG_POOL.map((card) => [card.id, {normal: 1, foil: 0}]));

/** Amber's cover, left to the rarest card you have. */
export const Binder: Story = {};

/** A card picked: it is ringed and marked, and The rarest card you have isn't. */
export const Picked: Story = {args: {binder: {...STORY_AMBER, coverId: 'amber-common'}}};

/** My collection's cover, over every card you have. */
export const MyCollection: Story = {args: {binder: null, shelfCover: 'emerald-epic'}};

/** A big collection: 40 cards, then Show more. */
export const ShowMore: Story = {args: {binder: null, pool: BIG_POOL, entries: BIG_ENTRIES}};

/** Find a card narrows the cards by name. */
export const Search: Story = {
  args: {binder: null, pool: BIG_POOL, entries: BIG_ENTRIES},
  play: async () => {
    await userEvent.type(within(document.body).getByRole('searchbox', {name: 'Find a card'}), 'moana');
  },
};

/** A binder holding none of your cards: The rarest card you have alone. */
export const NoneHeld: Story = {args: {entries: {}}};

/** A phone's sheet, which scrolls inside its height. */
export const Phone: Story = {
  args: {binder: null, pool: BIG_POOL, entries: BIG_ENTRIES, isMobile: true},
  globals: {viewport: {value: 'mobile1'}},
};
