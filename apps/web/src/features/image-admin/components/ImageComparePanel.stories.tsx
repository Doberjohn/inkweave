import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {ImageComparePanel} from './ImageComparePanel';

const card: LorcanaCard = {
  id: '5001',
  name: 'Elsa',
  fullName: 'Elsa - Snow Queen',
  cost: 8,
  ink: 'Amethyst',
  inkwell: true,
  type: 'Character',
  imageUrl: 'https://placehold.co/160x223',
};

const meta: Meta<typeof ImageComparePanel> = {
  title: 'ImageAdmin/ImageComparePanel',
  component: ImageComparePanel,
  args: {card, newImageUrl: null},
};
export default meta;

export const NoNewImage: StoryObj<typeof ImageComparePanel> = {};
export const WithNewImage: StoryObj<typeof ImageComparePanel> = {
  args: {newImageUrl: 'https://placehold.co/160x223/blue/white'},
};
