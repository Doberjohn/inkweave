import type {Meta, StoryObj} from '@storybook/react-vite';
import {PlaystyleFanTile, type FanCardData} from './PlaystyleFanTile';

const card = (id: number, fullName: string): FanCardData => ({
  id: String(id),
  fullName,
  imageUrl: `/card-images-preview/${id}.avif`,
  imageHashSm: undefined,
});

const meta: Meta<typeof PlaystyleFanTile> = {
  title: 'Features/Playstyles/PlaystyleFanTile',
  component: PlaystyleFanTile,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{maxWidth: 360, padding: 16}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Floodborns: Story = {
  args: {
    playstyleId: 'floodborn',
    name: 'Floodborns',
    accentColor: '#6b7280',
    accentRgb: '107, 114, 128',
    cardCount: 119,
    heroCard: card(13197, 'The Vine - Towering Stalk'),
    supportCards: [
      card(13115, 'Gaston - Created by the Vine'),
      card(13026, 'Ursula - Created by the Vine'),
      card(13192, 'Mulan - Created by the Vine'),
      card(1979, 'Elsa - Spirit of Winter'),
    ],
  },
};

export const RedPanda: Story = {
  args: {
    playstyleId: 'red-panda',
    name: 'Red Panda',
    accentColor: '#ef4444',
    accentRgb: '239, 68, 68',
    cardCount: 8,
    heroCard: card(13125, 'Meilin Lee - Popular Red Panda'),
    supportCards: [
      card(13007, 'Meilin Lee - Lead Vocalist'),
      card(13002, 'Ming Lee - Proud Parent'),
      card(13129, 'Ming Lee - Giant Red Panda'),
      card(13119, 'Sun Yee - Soul of the Red Panda'),
    ],
  },
};
