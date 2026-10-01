import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {createCard} from '../../../shared/test-utils';
import {COLORS} from '../../../shared/constants';
import type {Suggestion} from '../types';
import {SuggestionList} from './SuggestionList';

const cards = [
  createCard({id: 'a', fullName: 'Grab Your Sword'}),
  createCard({id: 'b', fullName: 'Fire the Cannons'}),
  createCard({id: 'c', fullName: 'Mickey Mouse - Brave Little Tailor'}),
];
const getCardById = (id: string) => cards.find((c) => c.id === id);
const sug = (cardId: string, reasons: string[]): Suggestion => ({cardId, synergyScore: 5, gapScore: 0, totalScore: 5, synergizesWith: [], reasons});

const meta: Meta<typeof SuggestionList> = {
  title: 'Deck/SuggestionList',
  component: SuggestionList,
  decorators: [
    (Story) => (
      <div style={{background: COLORS.background, width: 360, padding: 8}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {getCardById, onAdd: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Ranked: Story = {
  args: {
    suggestions: [
      sug('b', ['Fills removal gap']),
      sug('a', ['Synergizes with 6 deck cards']),
      sug('c', ['On-curve Song for a Singer']),
    ],
  },
};

// A fresh deck: too little to suggest against yet.
export const Empty: Story = {args: {suggestions: []}};
