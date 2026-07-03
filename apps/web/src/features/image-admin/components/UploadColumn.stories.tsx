import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {UploadColumn} from './UploadColumn';

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

const meta: Meta<typeof UploadColumn> = {
  title: 'ImageAdmin/UploadColumn',
  component: UploadColumn,
  args: {
    selectedCard: card,
    newImageUrl: null,
    imageName: null,
    canPublish: false,
    publishing: false,
    publishError: null,
    onImageChange: () => {},
    onPublish: () => {},
  },
};
export default meta;

export const NoCardSelected: StoryObj<typeof UploadColumn> = {
  args: {selectedCard: null},
};

export const CardSelected: StoryObj<typeof UploadColumn> = {};

export const ReadyToPublish: StoryObj<typeof UploadColumn> = {
  args: {newImageUrl: 'https://placehold.co/160x223/1a1a2e/d4af37?text=New', imageName: 'elsa.png', canPublish: true},
};
