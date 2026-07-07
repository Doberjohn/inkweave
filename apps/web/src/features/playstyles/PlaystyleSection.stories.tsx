import type {Meta, StoryObj} from '@storybook/react-vite';
import {PlaystyleSection} from './PlaystyleSection';
import {PlaystyleFanTile, type FanCardData} from './PlaystyleFanTile';

const card = (id: number, fullName: string): FanCardData => ({
  id: String(id),
  fullName,
  imageUrl: `/card-images-preview/${id}.avif`,
  imageHashSm: undefined,
});

const meta: Meta<typeof PlaystyleSection> = {
  title: 'Features/Playstyles/PlaystyleSection',
  component: PlaystyleSection,
  parameters: {backgrounds: {default: 'dark'}, layout: 'fullscreen'},
  decorators: [
    (Story) => (
      <div style={{padding: 24}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Tribes: Story = {
  args: {
    title: 'Tribes',
    subtitle: 'Decks built around one family of characters.',
    children: (
      <>
        <PlaystyleFanTile
          playstyleId="floodborn"
          name="Floodborns"
          accentColor="#6b7280"
          accentRgb="107, 114, 128"
          heroCard={card(3168, 'The Vine - Towering Stalk')}
          supportCards={[card(3086, 'Gaston'), card(2997, 'Ursula'), card(3163, 'Mulan'), card(1979, 'Elsa')]}
        />
        <PlaystyleFanTile
          playstyleId="hunny"
          name="Hunny"
          accentColor="#8b5cf6"
          accentRgb="139, 92, 246"
          heroCard={card(1977, 'Winnie the Pooh - Hunny Wizard')}
          supportCards={[card(3097, 'Tigger'), card(3054, 'Roo'), card(3032, 'Christopher Robin'), card(2976, 'Rabbit')]}
        />
      </>
    ),
  },
};
