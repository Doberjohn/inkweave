import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CardTile} from './CardTile';
import type {LorcanaCard} from '../types';

// A real Core card (set 9) whose self-hosted AVIF ships in public/card-images,
// so stories render the actual image instead of an error fallback (#512).
const createMockCard = (overrides: Partial<LorcanaCard> = {}): LorcanaCard => ({
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
  text: 'YOU JUST HAVE TO SEE IT — Name a card, then reveal the top card of your deck.',
  strength: 2,
  willpower: 3,
  lore: 1,
  imageUrl: '/card-images/1936.cdbd5dcfc4e4baf1.avif',
  setCode: '9',
  setNumber: 34,
  ...overrides,
});

const meta: Meta<typeof CardTile> = {
  title: 'Components/CardTile',
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
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    card: createMockCard(),
    isSelected: false,
  },
};

export const Selected: Story = {
  args: {
    card: createMockCard(),
    isSelected: true,
  },
};

// The compact variant used in dense grids.
export const Minimal: Story = {
  args: {
    card: createMockCard(),
    isSelected: false,
    variant: 'minimal',
  },
};

// Crawlable <a href> form (#486): plain click stays in-app, modified clicks follow the link.
export const CrawlableLink: Story = {
  args: {
    card: createMockCard(),
    isSelected: false,
    href: '/card/1936-bruno-madrigal-undetected-uncle',
  },
};

// Above-fold LCP candidate: lazy-loading disabled, fetch priority boosted.
export const Priority: Story = {
  args: {
    card: createMockCard(),
    isSelected: false,
    priority: true,
  },
};

// Grid-optimized 191x266 image. The mock's base URL uses the small variant's
// content hash so smallImageUrl's `-sm` derivation resolves to a real file.
export const SmallImage: Story = {
  args: {
    card: createMockCard({imageUrl: '/card-images/1936.c2298563d34f4ac4.avif'}),
    isSelected: false,
    useSmallImage: true,
  },
};

export const ActionCard: Story = {
  args: {
    card: createMockCard({
      name: 'Let It Go',
      version: undefined,
      fullName: 'Let It Go',
      type: 'Action',
      classifications: ['Song'],
      keywords: undefined,
      strength: undefined,
      willpower: undefined,
      lore: undefined,
    }),
    isSelected: false,
  },
};

export const ItemCard: Story = {
  args: {
    card: createMockCard({
      name: 'Magic Broom',
      version: 'Bucket Brigade',
      fullName: 'Magic Broom - Bucket Brigade',
      type: 'Item',
      ink: 'Amber',
      cost: 2,
      classifications: undefined,
      keywords: ['Broom'],
    }),
    isSelected: false,
  },
};

export const AllInkColors: Story = {
  render: () => (
    <div style={{display: 'flex', flexDirection: 'column', gap: '8px', width: '300px'}}>
      {(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'] as const).map((ink) => (
        <CardTile
          key={ink}
          card={createMockCard({ink, name: `${ink} Character`})}
          isSelected={false}
          onSelect={fn()}
        />
      ))}
    </div>
  ),
};
