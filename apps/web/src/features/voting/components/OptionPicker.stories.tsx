import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {OptionPicker} from './OptionPicker';

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

export const IsRealUnselected: Story = {
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

export const IsRealSelected: Story = {
  args: {
    ariaLabel: 'Is this synergy real',
    options: [
      {key: 'yes', label: 'Yes', value: true},
      {key: 'no', label: 'No', value: false},
      {key: 'unsure', label: 'Unsure', value: null},
    ],
    value: true,
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
};
