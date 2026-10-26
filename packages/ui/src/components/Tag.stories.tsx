import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONTS, SPACING} from '../tokens/theme';
import {Tag} from './Tag';

const meta: Meta<typeof Tag> = {
  title: 'Shared/Tag',
  component: Tag,
  tags: ['autodocs'],
  parameters: {layout: 'padded'},
  decorators: [
    (Story) => (
      <div style={{color: COLORS.text, fontFamily: FONTS.body}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

const TAG_ROW: React.CSSProperties = {display: 'flex', alignItems: 'center', gap: SPACING.sm};

/** A tag beside a name or a number: a word or two that says enough, and more on hover. */
export const Default: Story = {
  render: () => (
    <div style={{display: 'grid', gap: SPACING.xl}}>
      <div style={TAG_ROW}>
        <span>Location Boost</span>
        <Tag title="Fewer than 10 score votes">low n</Tag>
      </div>
      <div style={TAG_ROW}>
        <span>Distinct voters</span>
        <Tag title="From the raw vote log">raw</Tag>
      </div>
      <div style={TAG_ROW}>
        <span>Mei</span>
        <Tag title="Its data comes from previewCards.json">preview</Tag>
        <Tag title="In previewCards.json, not on inkweave.ink yet">not deployed yet</Tag>
      </div>
    </div>
  ),
};
