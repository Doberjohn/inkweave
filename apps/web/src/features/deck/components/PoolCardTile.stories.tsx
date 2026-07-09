import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {PoolCardTile} from './PoolCardTile';

// Real card thumbnails (direct Ravensburger .jpg) so the overhanging control is
// shown against actual art. smallImageUrl passes a non-.avif URL through, and an
// <img> loads cross-origin fine (Storybook has no image proxy). Hover any in-deck
// tile to grow the red − / green + stepper out of the count pill.
const RB = 'https://api.lorcana.ravensburger.com/images/en';

const pocahontas = (over: Partial<LorcanaCard> = {}): LorcanaCard => ({
  id: '2983',
  name: 'Pocahontas',
  fullName: 'Pocahontas - Guiding the Tribe',
  cost: 2,
  ink: 'Amber',
  inkwell: true,
  type: 'Character',
  imageUrl: `${RB}/set13/12_25a881827d54e9214c236aa95d2475a3dfd8ebce.jpg`,
  ...over,
});

const maleficent = (over: Partial<LorcanaCard> = {}): LorcanaCard => ({
  id: '2044',
  name: 'Maleficent',
  fullName: 'Maleficent - Monstrous Dragon',
  cost: 8,
  ink: 'Ruby',
  inkwell: false,
  type: 'Character',
  imageUrl: `${RB}/set9/108_83580e6844153a5788c87a6f9984a3c69de9c9c3.jpg`,
  ...over,
});

const meta: Meta<typeof PoolCardTile> = {
  title: 'Deck/PoolCardTile',
  component: PoolCardTile,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{width: 180, padding: 16}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onIncrement: fn(), onDecrement: fn(), onViewDetails: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Addable: Story = {args: {card: pocahontas(), deckInks: ['Amber'], inDeckCount: 0}};

export const InDeck: Story = {args: {card: pocahontas(), deckInks: ['Amber'], inDeckCount: 2}};

export const AtMaxCopies: Story = {args: {card: pocahontas(), deckInks: ['Amber'], inDeckCount: 4}};

// Ruby card while the deck is locked to Amber + Amethyst — dims + disables the +.
export const OffInk: Story = {args: {card: maleficent(), deckInks: ['Amber', 'Amethyst'], inDeckCount: 0}};
