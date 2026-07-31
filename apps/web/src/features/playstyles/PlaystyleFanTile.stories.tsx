import type {Meta, StoryObj} from '@storybook/react-vite';
import {PLAYSTYLE_UI} from '../../shared/constants';
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
    accentColor: PLAYSTYLE_UI.floodborn.accentColor,
    accentRgb: PLAYSTYLE_UI.floodborn.accentRgb,
    heroCard: card(3168, 'The Vine - Towering Stalk'),
    supportCards: [
      card(3086, 'Gaston - Created by the Vine'),
      card(2997, 'Ursula - Created by the Vine'),
      card(3163, 'Mulan - Created by the Vine'),
      card(1979, 'Elsa - Spirit of Winter'),
    ],
  },
};

export const RedPanda: Story = {
  args: {
    playstyleId: 'red-panda',
    name: 'Red Panda',
    accentColor: PLAYSTYLE_UI['red-panda'].accentColor,
    accentRgb: PLAYSTYLE_UI['red-panda'].accentRgb,
    heroCard: card(3096, 'Meilin Lee - Popular Red Panda'),
    supportCards: [
      card(2978, 'Meilin Lee - Lead Vocalist'),
      card(2973, 'Ming Lee - Proud Parent'),
      card(3100, 'Ming Lee - Giant Red Panda'),
      card(3090, 'Sun Yee - Soul of the Red Panda'),
    ],
  },
};
