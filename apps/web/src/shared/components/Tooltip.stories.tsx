import type {Meta, StoryObj} from '@storybook/react-vite';
import {Tooltip} from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Shared/Tooltip',
  component: Tooltip,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{padding: 80, minHeight: 220, background: '#1a1a2e'}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

const InfoButton = ({label = '?'}: {label?: string}) => (
  <button
    type="button"
    style={{
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: 'rgba(212, 175, 55, 0.06)',
      border: '1px solid rgba(212, 175, 55, 0.3)',
      color: 'rgba(212, 175, 55, 0.85)',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'help',
      lineHeight: 1,
    }}>
    {label}
  </button>
);

export const SingleLine: Story = {
  args: {
    content: 'Strong synergy — peak chain of free Shift cost reduction.',
    triggerAriaLabel: 'What does this score mean?',
    children: <InfoButton />,
  },
};

export const MultiLine: Story = {
  args: {
    content: 'Perfect — 9.5 and up\nStrong — 7 to 9.4\nModerate — 4 to 6.9\nWeak — under 4',
    triggerAriaLabel: 'Score scale',
    children: <InfoButton />,
  },
};

export const InlineWithText: Story = {
  args: {
    content: 'Computed by averaging the engine score across all matched rules in this group.',
    children: (
      <span style={{color: '#e8e8e8', fontSize: 14}}>
        Aggregate score <InfoButton />
      </span>
    ),
  },
};
