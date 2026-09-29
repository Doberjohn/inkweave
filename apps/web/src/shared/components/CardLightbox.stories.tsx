import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardLightbox} from './CardLightbox';
import {COLORS} from '../constants';

const meta: Meta<typeof CardLightbox> = {
  title: 'Components/CardLightbox',
  component: CardLightbox,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  args: {
    src: 'https://lorcana-api.com/images/tfc/1/en/full.webp',
    alt: 'Elsa - Snow Queen',
    onClose: () => {},
  },
};

/** A card revealed abroad first: its only scan is Japanese, so the lightbox offers the English text. */
export const WithTranslation: Story = {
  args: {
    src: '/card-images-preview/14014.avif',
    alt: 'Elsa - Snow Queen',
    card: {
      id: '14901',
      name: 'Elsa',
      version: 'Snow Queen',
      fullName: 'Elsa - Snow Queen',
      cost: 5,
      ink: 'Sapphire',
      inkwell: true,
      type: 'Character',
      setCode: '14',
      scanLanguage: 'ja',
      textSections: [
        'FROZEN STILLNESS At the end of your turn, if you’ve played 2 or more characters this turn, draw a card.',
      ],
    },
    onClose: () => {},
  },
};

export const WithBrokenImage: Story = {
  args: {
    src: 'https://invalid-url.example/missing.webp',
    alt: 'Missing card',
    onClose: () => {},
  },
};

export const InteractiveToggle: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{padding: 40}}>
        <button
          onClick={() => setOpen(true)}
          style={{
            padding: '10px 20px',
            background: COLORS.primary,
            color: '#000',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 600,
          }}>
          Open Lightbox
        </button>
        {open && (
          <CardLightbox
            src="https://lorcana-api.com/images/tfc/1/en/full.webp"
            alt="Elsa - Snow Queen"
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    );
  },
};
