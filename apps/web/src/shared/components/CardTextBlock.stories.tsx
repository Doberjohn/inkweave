import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTextBlock} from './CardTextBlock';

const card = (overrides: Partial<LorcanaCard> = {}): LorcanaCard =>
  ({
    id: '1',
    name: 'Elsa',
    fullName: 'Elsa - Snow Queen',
    cost: 5,
    ink: 'Sapphire',
    type: 'Character',
    ...overrides,
  }) as LorcanaCard;

const meta: Meta<typeof CardTextBlock> = {
  title: 'Shared/CardTextBlock',
  component: CardTextBlock,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 350, background: '#1a1a2e', padding: 16, borderRadius: 8}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleAbility: Story = {
  args: {
    card: card({
      text: 'When you play this character, draw 2 cards.',
      textSections: ['When you play this character, draw 2 cards.'],
    }),
  },
};

export const MultipleAbilities: Story = {
  args: {
    card: card({
      text: 'FREEZE ↷ — Exert chosen opposing character.\nA WONDERFUL DREAM ↷ — Draw a card.',
      textSections: [
        'FREEZE ↷ — Exert chosen opposing character.',
        'A WONDERFUL DREAM ↷ — Draw a card.',
      ],
    }),
  },
};

export const WithReminderText: Story = {
  args: {
    card: card({
      text: 'Singer 5 (This character can exert to sing songs with cost up to 5.)',
      textSections: ['Singer 5 (This character can exert to sing songs with cost up to 5.)'],
    }),
  },
};

export const FallbackToText: Story = {
  args: {
    card: card({
      text: 'Simple ability text with no sections.',
      textSections: undefined,
    }),
  },
};

export const NoText: Story = {
  args: {
    card: card({text: undefined, textSections: undefined}),
  },
};
