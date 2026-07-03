import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardImagePicker} from './CardImagePicker';

function card(p: Partial<LorcanaCard>): LorcanaCard {
  return {id: '1', name: 'X', fullName: 'X', cost: 1, ink: 'Amber', inkwell: true, type: 'Character', ...p};
}

const cards = [
  card({id: '5001', name: 'Elsa', fullName: 'Elsa - Snow Queen'}),
  card({id: '5002', name: 'Anna', fullName: 'Anna - Heir to Arendelle'}),
  card({id: '5003', name: 'Mickey Mouse', fullName: 'Mickey Mouse - Brave Little Tailor'}),
];

const meta: Meta<typeof CardImagePicker> = {
  title: 'ImageAdmin/CardImagePicker',
  component: CardImagePicker,
  args: {cards, selectedId: '5002', onSelect: () => {}},
};
export default meta;

export const Default: StoryObj<typeof CardImagePicker> = {};
