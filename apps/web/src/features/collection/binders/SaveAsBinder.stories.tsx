import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {ALL_PROMO_SETS, WHOLE_COLLECTION} from '../binderCards';
import type {SaveOffer} from './binderChoices';
import {SaveAsBinder} from './SaveAsBinder';

/**
 * Save as a binder's box: the page's filters kept as a binder of their own. Its name starts as the
 * filters' own, selected; under it what the binder would hold, its rules and Sets as chips, and
 * its count. Saves reach the server, so these stories never press Save binder; its unit tests
 * hold the saving and failure states. A dialog on a computer, a sheet on a phone.
 */
const AMBER_OFFER: SaveOffer = {
  scope: WHOLE_COLLECTION,
  rules: 'ink=Amber',
  line: 'Amber ink',
  figures: {complete: 293, master: 120, cards: 625},
};

const meta: Meta<typeof SaveAsBinder> = {
  title: 'Collection/Binders/SaveAsBinder',
  component: SaveAsBinder,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    offer: AMBER_OFFER,
    readerId: 'story-reader',
    isMobile: false,
    onSaved: fn(),
    onMoreRules: fn(),
    onClose: fn(),
    onGone: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Amber ink over every set. */
export const Default: Story = {};

/** Several rules and a search, at one set. */
export const ManyRules: Story = {
  args: {
    offer: {
      scope: '12',
      rules: 'ink=Amber&rarity=Epic&type=Character&q=elsa',
      line: 'Amber ink · Epic · Character · Name has "elsa" · The Wilds Unknown',
      figures: {complete: 3, master: 1, cards: 7},
    },
  },
};

/** The promo sets, counted as promos. */
export const Promos: Story = {
  args: {offer: {scope: ALL_PROMO_SETS, rules: 'ink=Ruby', line: 'Ruby ink · All promo sets', figures: {complete: 1, master: 0, cards: 1}}},
};

/** A phone's sheet. */
export const Phone: Story = {args: {isMobile: true}, globals: {viewport: {value: 'mobile1'}}};
