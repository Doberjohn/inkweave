import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, SPACING} from '../../../shared/constants';
import {CoverChoices, type CoverChoicesProps} from './CoverChoices';

/** The choices at a width they meet, picking as the window does. */
function Choices({chosen, width, ...rest}: CoverChoicesProps & {width: number}) {
  const [picked, setPicked] = useState(chosen);
  return (
    <div style={{width, padding: SPACING.xl, background: COLORS.surface}}>
      <CoverChoices {...rest} chosen={picked} onPick={(design) => setPicked(design.id)} />
    </div>
  );
}

/**
 * The eight cover designs to pick from, four across, the chosen one ringed in gold and marked.
 * Change cover names each under it; the New binder window's preview column, too narrow for the
 * names, leaves them to screen readers.
 */
const meta: Meta<typeof Choices> = {
  title: 'Collection/Binders/CoverChoices',
  component: Choices,
  tags: ['autodocs'],
  args: {chosen: 'sunburst', named: true, disabled: false, width: 420},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Change cover's choices, named. */
export const Named: Story = {};

/** The New binder window's, under its cover in the preview column. */
export const InTheWindow: Story = {args: {named: false, chosen: 'starry-night', width: 300}};

/** While a pick saves. */
export const Saving: Story = {args: {disabled: true}};
