import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardPreviewPanel} from './CardPreviewPanel';
import type {LorcanaCard} from '../../cards/types';

const sample: LorcanaCard = {
  id: '3021',
  name: 'Mei',
  version: 'Red Panda',
  fullName: 'Mei - Red Panda',
  cost: 4,
  ink: 'Ruby',
  inkwell: true,
  type: 'Character',
  strength: 3,
  willpower: 5,
  lore: 2,
  setCode: '13',
  rarity: 'Rare',
};

const meta: Meta<typeof CardPreviewPanel> = {
  title: 'Reveal Admin/CardPreviewPanel',
  component: CardPreviewPanel,
  args: {onImageChange: () => {}},
};
export default meta;
type Story = StoryObj<typeof CardPreviewPanel>;

export const WithCard: Story = {args: {card: sample}};
export const Empty: Story = {args: {card: null}};
