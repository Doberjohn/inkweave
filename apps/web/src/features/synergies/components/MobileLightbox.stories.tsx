import type {Meta, StoryObj} from '@storybook/react-vite';
import {MobileLightbox} from './MobileLightbox';

const meta = {
  title: 'Synergies/MobileLightbox',
  component: MobileLightbox,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // Lightbox uses position: absolute, so it needs a positioned ancestor. A 390×844 frame
      // simulates the mobile modal it sits inside.
      <div style={{position: 'relative', width: 390, height: 844, background: '#1a1a2e', border: '1px solid #333355', borderRadius: 22, overflow: 'hidden', margin: '24px auto'}}>
        <div style={{padding: 20, color: '#90a1b9', fontFamily: "'Plus Jakarta Sans', sans-serif"}}>
          (Underlying modal contents — obscured by the lightbox)
        </div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MobileLightbox>;

export default meta;
type Story = StoryObj<typeof meta>;

const SAMPLE_IMG = '/card-images/en/set6/35_b9afe49519236b60d7d6eca0359905ef44cecae9.jpg';
const SAMPLE_IMG_AMETHYST = '/card-images/en/set5/17_ddeed71f4dda35d719ac840da0c7ca6acda52796.jpg';

export const AmberTint: Story = {
  args: {
    imageUrl: SAMPLE_IMG,
    alt: 'Sugar Rush Speedway - Finish Line',
    ink: 'Amber',
    originRect: null,
    onClose: () => {},
  },
};

export const AmethystTint: Story = {
  args: {
    imageUrl: SAMPLE_IMG_AMETHYST,
    alt: 'Fix-It Felix, Jr. - Delighted Sightseer',
    ink: 'Amethyst',
    originRect: null,
    onClose: () => {},
  },
};

export const EmeraldTint: Story = {
  args: {
    imageUrl: SAMPLE_IMG,
    alt: 'Sample Emerald card',
    ink: 'Emerald',
    originRect: null,
    onClose: () => {},
  },
};
