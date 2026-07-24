import type {Meta, StoryObj} from '@storybook/react-vite';
import {createCard} from '../../../shared/test-utils';
import {COLORS} from '../../../shared/constants';
import type {DeckSynergyResult} from '../analysis/deckSynergy';
import {SynergySurface} from './SynergySurface';

const cards = [
  createCard({id: 'a', fullName: 'Elsa - Snow Queen'}),
  createCard({id: 'b', fullName: 'Anna - Heir to Arendelle'}),
  createCard({id: 'c', fullName: 'Olaf - Friendly Snowman'}),
  createCard({id: 'w', fullName: 'Stray Filler - No Synergy'}),
];
const getCardById = (id: string) => cards.find((card) => card.id === id);

const synergy: DeckSynergyResult = {
  overallScore: 72,
  keyCards: ['a', 'b', 'c'],
  weakLinks: ['w'],
  connectionCounts: {a: 8, b: 6, c: 5, w: 1},
};

const meta: Meta<typeof SynergySurface> = {
  title: 'Deck/SynergySurface',
  component: SynergySurface,
  decorators: [
    (Story) => (
      <div style={{background: COLORS.background, width: 340, padding: 8}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {getCardById},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const KeyCardsAndWeakLinks: Story = {args: {synergy}};

export const NoWeakLinks: Story = {
  args: {synergy: {overallScore: 84, keyCards: ['a', 'b'], weakLinks: [], connectionCounts: {a: 9, b: 7}}},
};

// A fresh deck with no standout hubs: the surface shows its guiding empty note.
export const Empty: Story = {
  args: {synergy: {overallScore: 0, keyCards: [], weakLinks: [], connectionCounts: {}}},
};
