import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONT_SIZES, hexRgba} from '../constants';
import {HelpTooltip, Tooltip} from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Shared/Tooltip',
  component: Tooltip,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{padding: 80, minHeight: 220, background: COLORS.surface}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The score scale, as the comparison's Engine column words it. */
const SCORE_SCALE = 'Perfect — 9.5 and up\nStrong — 7 to 9.4\nModerate — 4 to 6.9\nWeak — under 4';

/** A "?" button named by `label`, described by the tooltip while it shows. */
const InfoButton = ({label, describedBy}: {label: string; describedBy: string | undefined}) => (
  <button
    type="button"
    aria-label={label}
    aria-describedby={describedBy}
    style={{
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: hexRgba(COLORS.primary500, 0.06),
      border: `1px solid ${hexRgba(COLORS.primary500, 0.3)}`,
      color: hexRgba(COLORS.primary500, 0.85),
      fontSize: FONT_SIZES.md,
      fontWeight: 700,
      cursor: 'help',
      lineHeight: 1,
    }}>
    ?
  </button>
);

export const SingleLine: Story = {
  args: {
    content: 'Strong synergy — peak chain of free Shift cost reduction.',
    children: (describedBy) => (
      <InfoButton label="What does this score mean?" describedBy={describedBy} />
    ),
  },
};

export const MultiLine: Story = {
  args: {
    content: SCORE_SCALE,
    children: (describedBy) => <InfoButton label="Score scale" describedBy={describedBy} />,
  },
};

export const InlineWithText: Story = {
  args: {
    content: 'Computed by averaging the engine score across all matched rules in this group.',
    children: (describedBy) => (
      <span style={{color: COLORS.text, fontSize: FONT_SIZES.lg}}>
        Aggregate score{' '}
        <InfoButton label="How is the aggregate score computed?" describedBy={describedBy} />
      </span>
    ),
  },
};

/** `HelpTooltip`: the "?" circle the comparison's Engine column puts beside its score. */
export const Help: Story = {
  render: () => <HelpTooltip content={SCORE_SCALE} label="What does this score mean?" />,
};
