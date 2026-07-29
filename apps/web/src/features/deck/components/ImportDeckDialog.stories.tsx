import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {createCard} from '../../../shared/test-utils';
import {ImportDeckDialog} from './ImportDeckDialog';

const pool = [
  createCard({id: '1', fullName: 'Angel - Experiment 624', setCode: '11', setNumber: 191}),
  createCard({id: '2', fullName: 'Nani - Stage Manager', setCode: '11', setNumber: 20}),
  createCard({id: '3', fullName: 'Bambi - Ethereal Fawn', setCode: '11', setNumber: 24}),
];

const meta: Meta<typeof ImportDeckDialog> = {
  title: 'Deck/ImportDeckDialog',
  component: ImportDeckDialog,
  tags: ['autodocs'],
  args: {isOpen: true, onClose: fn(), onImport: fn(), pool, currentCardCount: 0},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

// Importing REPLACES the deck, so a non-empty deck is called out before committing.
export const ReplacingAnExistingDeck: Story = {args: {currentCardCount: 56}};
