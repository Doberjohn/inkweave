import type {Meta, StoryObj} from '@storybook/react-vite';
import {BinderMedal} from './BinderMedal';
import {COVER_DESIGNS, coverDesign} from './coverDesigns';

/**
 * A binder's medal: a round crop of its cover's pattern, inside a dark and a faint light rim. The
 * set picker draws it at 24px in the Binders tab's rows, 18px in the toolbar's button, and up to
 * 36px in the panel's.
 */
const meta: Meta<typeof BinderMedal> = {
  title: 'Collection/Binders/BinderMedal',
  component: BinderMedal,
  tags: ['autodocs'],
  args: {design: coverDesign('sunburst'), size: 24},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A row's medal, 24px. */
export const Row: Story = {};

/** The panel's button's, 36px. */
export const Panel: Story = {args: {size: 36}};

/** My collection's while its cover is still to be read: an empty ring. */
export const Waiting: Story = {args: {design: null}};

/** Each of the eight at the panel's size. */
export const EveryDesign: Story = {
  render: (args) => (
    <div style={{display: 'flex', gap: 16, padding: 16}}>
      {COVER_DESIGNS.map((design) => (
        <BinderMedal key={design.id} {...args} design={design} size={36} />
      ))}
    </div>
  ),
};
