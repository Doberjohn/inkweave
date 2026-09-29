import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTranslationPanel} from './CardTranslationPanel';

const card = (overrides: Partial<LorcanaCard> = {}): LorcanaCard =>
  ({
    id: '14901',
    name: 'Elsa',
    version: 'Snow Queen',
    fullName: 'Elsa - Snow Queen',
    cost: 5,
    ink: 'Sapphire',
    type: 'Character',
    setCode: '14',
    scanLanguage: 'ja',
    textSections: [
      'Support (Whenever this character quests, you may add their ¤ to another chosen character’s ¤ this turn.)',
      'FROZEN STILLNESS At the end of your turn, if you’ve played 2 or more characters this turn, draw a card.',
    ],
    ...overrides,
  }) as LorcanaCard;

const meta: Meta<typeof CardTranslationPanel> = {
  title: 'Shared/CardTranslationPanel',
  component: CardTranslationPanel,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 367, height: 512, display: 'flex'}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const JapaneseCharacter: Story = {
  args: {card: card(), style: {flex: 1}},
};

export const GermanAction: Story = {
  args: {
    card: card({
      name: 'Frozen Fanfare',
      version: undefined,
      fullName: 'Frozen Fanfare',
      type: 'Action',
      scanLanguage: 'de',
      textSections: ['Exert chosen opposing character. Draw a card.'],
    }),
    style: {flex: 1},
  },
};

export const NoRulesText: Story = {
  args: {card: card({textSections: undefined, scanLanguage: 'it'}), style: {flex: 1}},
};
