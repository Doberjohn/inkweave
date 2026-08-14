import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {NavArrowButton} from './NavArrowButton';
import {COLORS, RADIUS, SPACING} from '../constants';

/**
 * The round gold arrow shared by the card-overview modal and the binder.
 *
 * It is `position: absolute` by construction, so the decorator supplies the
 * relatively-positioned thing it flanks — without one it would anchor to the
 * story canvas and the placement would tell you nothing.
 */
const meta: Meta<typeof NavArrowButton> = {
  title: 'Shared/NavArrowButton',
  component: NavArrowButton,
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          width: 320,
          height: 180,
          margin: SPACING.xxl,
          background: COLORS.surfaceRaised,
          borderRadius: `${RADIUS.card}px`,
        }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {direction: 'prev', label: 'Previous', onClick: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Laid out inline, the way the binder places it beside the spread. */
export const Previous: Story = {};

export const Next: Story = {
  args: {direction: 'next', label: 'Next'},
};

/**
 * Hung half outside a panel, the way the card-overview modal places it — the
 * consumer supplies the whole overlay treatment, since the base has no
 * `position` of its own.
 */
export const Overlaid: Story = {
  args: {style: {position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: -22}},
};

/**
 * Disabled — the binder's first and last spread. The modal never uses this,
 * because sibling-card nav wraps around instead of ending.
 */
export const Disabled: Story = {
  args: {disabled: true},
};
