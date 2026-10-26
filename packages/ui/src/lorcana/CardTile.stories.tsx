import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile, type TileArt} from './CardTile';

// A real Core card (set 9) whose self-hosted AVIF ships in public/card-images, so the stories
// render its art instead of the cost fallback (#512).
const bruno: LorcanaCard = {
  id: '1936',
  name: 'Bruno Madrigal',
  version: 'Undetected Uncle',
  fullName: 'Bruno Madrigal - Undetected Uncle',
  cost: 4,
  ink: 'Amethyst',
  inkwell: true,
  type: 'Character',
  classifications: ['Storyborn', 'Ally', 'Madrigal'],
  keywords: ['Evasive'],
  strength: 2,
  willpower: 3,
  lore: 1,
  imageUrl: '/card-images/1936.cdbd5dcfc4e4baf1.avif',
  setCode: '9',
  setNumber: 34,
};

const meta: Meta<typeof CardTile> = {
  title: 'Lorcana/CardTile',
  component: CardTile,
  decorators: [
    (Story) => (
      <div style={{width: '300px'}}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    card: bruno,
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// As admin renders it (inkweave-admin#102): neither seam, a button showing the card's own art.
export const NoSeams: Story = {
  args: {
    isSelected: false,
    tabIndex: -1,
  },
};

// A crawlable link (#486) with no onIntent: the pointer arriving or focus landing runs nothing.
export const LinkWithoutIntent: Story = {
  args: {
    href: '/card/1936-bruno-madrigal-undetected-uncle',
  },
};

// As the app's grids render a link tile: their small art, the `-sm` file beside the full one
// (the mock's URL carries the small file's content hash, so it resolves), and onIntent, which
// warms the card modal there (#640), as the pointer arrives or focus lands.
export const WithSeams: Story = {
  args: {
    card: {...bruno, imageUrl: '/card-images/1936.c2298563d34f4ac4.avif'},
    href: '/card/1936-bruno-madrigal-undetected-uncle',
    artUrl: (art: TileArt) => art.imageUrl?.replace(/\.avif$/, '-sm.avif'),
    onIntent: fn(),
  },
};
