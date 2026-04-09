import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {OptionPicker} from './OptionPicker';
import type {OptionColor} from './OptionPicker';

function makeColor(hex: string): OptionColor {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    border: hex,
    glow: `rgba(${r},${g},${b},0.15)`,
    hintBg: `rgba(${r},${g},${b},0.06)`,
    hoverBorder: `rgba(${r},${g},${b},0.35)`,
  };
}

const GREEN = makeColor('#6ee7a0');
const RED = makeColor('#f59090');
const BLUE = makeColor('#60b5f5');
const AMBER = makeColor('#d4af37');

const meta = {
  title: 'Voting/OptionPicker',
  component: OptionPicker,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 500, background: '#1a1a2e', padding: 24, borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
  args: {onChange: fn()},
} satisfies Meta<typeof OptionPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultGold: Story = {
  args: {
    ariaLabel: 'Is this synergy real',
    options: [
      {key: 'yes', label: 'Yes', value: true},
      {key: 'no', label: 'No', value: false},
      {key: 'unsure', label: 'Unsure', value: null},
    ],
    value: null,
  },
};

export const SemanticColors: Story = {
  args: {
    ariaLabel: 'Is this synergy real',
    options: [
      {key: 'yes', label: 'Yes', value: true},
      {key: 'no', label: 'No', value: false},
      {key: 'unsure', label: 'Unsure', value: null},
    ],
    value: null,
    colorScheme: {yes: GREEN, no: RED, unsure: AMBER},
  },
};

export const SelectedWithDimming: Story = {
  args: {
    ariaLabel: 'Is our score accurate',
    options: [
      {key: 'low', label: 'Too Low', value: -1},
      {key: 'right', label: 'About Right', value: 0},
      {key: 'high', label: 'Too High', value: 1},
    ],
    value: 0,
    colorScheme: {low: RED, right: GREEN, high: BLUE},
  },
};

export const DifficultySelected: Story = {
  args: {
    ariaLabel: 'How easy to pull off',
    options: [
      {key: 'easy', label: 'Easy', value: 1},
      {key: 'situational', label: 'Situational', value: 2},
      {key: 'hard', label: 'Hard', value: 3},
    ],
    value: 2,
    colorScheme: {easy: GREEN, situational: BLUE, hard: RED},
  },
};

export const Mobile: Story = {
  args: {
    ariaLabel: 'Would you play these together',
    options: [
      {key: 'yes', label: 'Yes', value: 'yes'},
      {key: 'no', label: 'No', value: 'no'},
      {key: 'already', label: 'Already do', value: 'already'},
    ],
    value: null,
    isMobile: true,
  },
  parameters: {viewport: {defaultViewport: 'mobile1'}},
};
