import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {Segment, Segments} from './Segments';
import {SIDE_PANEL_STYLE, SIDE_PANEL_WIDTH} from '../cards/components/BrowseSidePanel';
import {SPACING} from '../../shared/constants';

interface LiveSegmentsProps {
  label: string;
  columns: string;
  options: string[];
}

/** A row of segments, live: press one and it is the chosen one. */
function LiveSegments({label, columns, options}: LiveSegmentsProps) {
  const [chosen, setChosen] = useState(options[0]);
  return (
    <Segments label={label} columns={columns}>
      {options.map((option) => (
        <Segment key={option} label={option} active={chosen === option} onSelect={() => setChosen(option)} />
      ))}
    </Segments>
  );
}

const meta: Meta<typeof LiveSegments> = {
  title: 'Collection/Segments',
  component: LiveSegments,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** What the binder shows, in the set panel: equal segments. */
export const BinderShows: Story = {
  args: {label: 'Binder shows', columns: 'repeat(3, 1fr)', options: ['All', 'Owned', 'Missing']},
  decorators: [
    (Story) => (
      <div style={SIDE_PANEL_STYLE}>
        <Story />
      </div>
    ),
  ],
};

/**
 * The set picker's tabs (owner, 2026-10-20), across the menu's inside (a side panel's width,
 * less its 4px padding and 1px rim). The picker gives Promo sets the promo symbol too.
 */
export const SetPickerTabs: Story = {
  args: {label: 'Sets', columns: 'repeat(2, 1fr)', options: ['Standard', 'Promo']},
  decorators: [
    (Story) => (
      <div style={{width: SIDE_PANEL_WIDTH - 2 * (SPACING.xs + 1)}}>
        <Story />
      </div>
    ),
  ],
};
