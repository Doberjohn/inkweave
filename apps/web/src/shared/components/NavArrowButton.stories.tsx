import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {NavArrowButton} from './NavArrowButton';
import {COLORS, RADIUS, SPACING} from '../constants';

/**
 * The binder's gold arrow: round beside the spread, and the worded pill the spread
 * map uses. A filled CtaButton underneath, so it boops as the pointer arrives.
 *
 * It has no `position` of its own, so the decorator supplies the relatively-
 * positioned thing the Overlaid story hangs it from; without one it would anchor
 * to the story canvas and the placement would tell you nothing.
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
 * Hung half outside a panel: the consumer supplies the whole overlay treatment,
 * since the base has no `position` of its own. Offset with `top`, not
 * `transform`, which the boop and the press own.
 */
export const Overlaid: Story = {
  args: {style: {position: 'absolute', top: 'calc(50% - 22px)', left: -22}},
};

/** Disabled — the binder's first and last spread. */
export const Disabled: Story = {
  args: {disabled: true},
};

/** With its word, a gold pill: the spread map's Previous button, at the map's 34px. */
export const WordedPrevious: Story = {
  args: {label: 'Previous spread', text: 'Previous', style: {height: 34}},
};

/** The spread map's Next button: the word before the chevron. */
export const WordedNext: Story = {
  args: {direction: 'next', label: 'Next spread', text: 'Next', style: {height: 34}},
};
