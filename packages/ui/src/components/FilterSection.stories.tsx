import type {Meta, StoryObj} from '@storybook/react-vite';
import {FilterSection} from './FilterSection';
import {COLORS, RADIUS, SPACING} from '../tokens/theme';

/** Stand-in for a section's filters. */
const content = (
  <div style={{padding: SPACING.sm, background: COLORS.surface, borderRadius: RADIUS.sm}}>Filter content</div>
);

const meta: Meta<typeof FilterSection> = {
  title: 'Shared/FilterSection',
  component: FilterSection,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 300}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {label: 'Ink Color', children: content},
};

/**
 * Browse's docked panel folds its sections (owner, 2026-10-08). The whole header line is the
 * toggle, and hovering it washes the line in faint gold (owner, 2026-10-12). Folded, it shows
 * what is selected inside.
 */
export const Collapsible: Story = {
  args: {label: 'Type', collapsible: {defaultOpen: false}, summary: 'Character', children: content},
};

export const Compact: Story = {
  args: {label: 'Keywords', compact: true, children: content},
};
