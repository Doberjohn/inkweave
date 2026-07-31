import type {Meta, StoryObj} from '@storybook/react-vite';
import {PLAYSTYLE_UI} from '../../shared/constants';
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
  parameters: {layout: 'fullscreen'},
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
          accentColor={PLAYSTYLE_UI.floodborn.accentColor}
          accentRgb={PLAYSTYLE_UI.floodborn.accentRgb}
          heroCard={card(3168, 'The Vine - Towering Stalk')}
          supportCards={[card(3086, 'Gaston'), card(2997, 'Ursula'), card(3163, 'Mulan'), card(1979, 'Elsa')]}
        />
        <PlaystyleFanTile
          playstyleId="hunny"
          name="Hunny"
          accentColor={PLAYSTYLE_UI.hunny.accentColor}
          accentRgb={PLAYSTYLE_UI.hunny.accentRgb}
          heroCard={card(1977, 'Winnie the Pooh - Hunny Wizard')}
          supportCards={[card(3097, 'Tigger'), card(3054, 'Roo'), card(3032, 'Christopher Robin'), card(2976, 'Rabbit')]}
        />
      </>
    ),
  },
};
