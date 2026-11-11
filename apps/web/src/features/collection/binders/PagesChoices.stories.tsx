import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, SPACING} from '../../../shared/constants';
import type {PageSide} from '../../cards/components/binderGeometry';
import {PagesChoices, type PagesChoicesProps} from './PagesChoices';

/** The choices at a width they meet, picking as the window does. */
function Choices({chosen, width, ...rest}: Omit<PagesChoicesProps, 'onPick'> & {width: number}) {
  const [picked, setPicked] = useState<PageSide>(chosen);
  return (
    <div style={{width, padding: SPACING.xl, background: COLORS.surface}}>
      <PagesChoices {...rest} chosen={picked} onPick={setPicked} />
    </div>
  );
}

/**
 * How many cards a binder's page holds: 2 × 2, 3 × 3 or 4 × 4, each a small page of its pockets,
 * the chosen one ringed in gold and marked. The New binder window shows them under Sets, Save as
 * a binder under its name, and My collection's Change page size on its own.
 */
const meta: Meta<typeof Choices> = {
  title: 'Collection/Binders/PagesChoices',
  component: Choices,
  tags: ['autodocs'],
  args: {chosen: 4, disabled: false, width: 360},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The default, 4 × 4. */
export const FourByFour: Story = {};

/** 2 × 2 picked, at a phone sheet's width. */
export const Narrow: Story = {args: {chosen: 2, width: 300}};

/** While a pick saves. */
export const Saving: Story = {args: {disabled: true}};
