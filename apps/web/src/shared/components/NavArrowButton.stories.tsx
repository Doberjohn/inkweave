import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {EDGE_DISC_SIZE, NavArrowButton} from './NavArrowButton';
import {COLORS, RADIUS, SPACING} from '../constants';

/**
 * The binder's gold arrow: round beside the spread, and the small disc on the spread's
 * outer edges where Browse docks its panels, which grows under the pointer. A filled
 * CtaButton underneath, so it boops as the pointer arrives.
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

/** At the binder's first or last spread: dimmed and inert, but still focusable (#790). */
export const AtEnd: Story = {
  args: {atEnd: true},
};

/**
 * The disc for the spread's outer edge (owner, 2026-10-22), hung on this panel's edge as the
 * binder hangs it on a page's: 28px at rest, 40 under the pointer or the keyboard's focus,
 * growing about its centre.
 */
export const Edge: Story = {
  args: {
    label: 'Previous spread',
    edge: true,
    style: {position: 'absolute', top: `calc(50% - ${EDGE_DISC_SIZE / 2}px)`, left: SPACING.md - EDGE_DISC_SIZE},
  },
};

/** At the binder's end the disc stays small: dimmed and inert, but still focusable (#790). */
export const EdgeAtEnd: Story = {
  args: {...Edge.args, atEnd: true},
};
