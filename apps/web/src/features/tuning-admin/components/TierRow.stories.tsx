import type {Meta, StoryObj} from '@storybook/react-vite';
import {TierRow} from './TierRow';

const meta: Meta<typeof TierRow> = {
  title: 'TuningAdmin/TierRow',
  component: TierRow,
  args: {
    label: 'curve.gap3',
    text: 'Wide 3-turn gap. Playable but slow to set up.',
    score: 5,
    showText: true,
    showScore: true,
    onTextChange: () => {},
    onScoreChange: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{maxWidth: 480}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof TierRow>;

export const TextAndScore: Story = {};

export const TextOnly: Story = {
  args: {label: 'Tagline', showScore: false, score: undefined},
};

export const ScoreOnly: Story = {
  args: {label: 'score · density', showText: false, text: undefined},
};

export const WithErrors: Story = {
  args: {textError: 'Text must not be empty', scoreError: 'Score must be between 1 and 10'},
};
