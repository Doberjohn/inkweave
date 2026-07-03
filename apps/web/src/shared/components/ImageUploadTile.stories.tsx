import type {Meta, StoryObj} from '@storybook/react-vite';
import {ImageUploadTile} from './ImageUploadTile';

const meta: Meta<typeof ImageUploadTile> = {
  title: 'Admin/ImageUploadTile',
  component: ImageUploadTile,
  args: {imageUrl: null, onImageChange: () => {}},
};
export default meta;

export const Empty: StoryObj<typeof ImageUploadTile> = {};

export const WithImage: StoryObj<typeof ImageUploadTile> = {
  args: {imageUrl: 'https://placehold.co/160x223/1a1a2e/d4af37?text=Card'},
};
