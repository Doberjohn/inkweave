import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink} from 'inkweave-synergy-engine';
import {BinderSpreadMap, type MapSet, type Pocket} from './BinderSpreadMap';
import {ALL_INKS, COLORS, SET_NAMES, SPACING, type SetCode} from '../../../shared/constants';

/**
 * The binder's pager where Browse docks its panels (owner, 2026-10-12): the spreads in
 * miniature, one cell per pocket in its card's ink, filled where you hold the card and a
 * ring where you are missing it. The window holds as many spreads as fit the row, eleven
 * at most; going set by set, each spread names its sets on hover. Live here: click a
 * spread, or step with Previous and Next.
 */

/**
 * A set's pockets in collector order, the way real sets run: the main cards in six ink
 * blocks, Amber to Steel, then the chase printings through the inks again. Every
 * `dualEvery`th card is dual-ink, with the next ink as its second.
 */
function setPockets(size: number, owned: (i: number) => boolean, dualEvery = 11): Pocket[] {
  const main = size - 38;
  return Array.from({length: size}, (_, i) => {
    const block = i < main ? Math.floor((i / main) * ALL_INKS.length) : (i - main) % ALL_INKS.length;
    const inks: Ink[] = [ALL_INKS[block]];
    if (i % dualEvery === dualEvery - 1) inks.push(ALL_INKS[(block + 1) % ALL_INKS.length]);
    return {owned: owned(i), inks};
  });
}

/** A Set 13-sized binder, 207 pockets, with about a third of them held. */
const PART_COLLECTED = setPockets(207, (i) => (i * 7) % 11 < 4);

/** Each set's binder pockets, 14 down to 1, as the real pool holds them: base cards plus printings. */
const SET_SIZES = [242, 245, 242, 242, 242, 243, 224, 224, 222, 223, 225, 227, 216, 216];

/**
 * The whole collection, set by set as the binder lays it out, each set continuing where
 * the one before ends: mostly held, each set's last 38 pockets its chase printings, most
 * of them missing. 135 spreads in all.
 */
const WHOLE: Pocket[] = SET_SIZES.flatMap((size, i) =>
  setPockets(size, (p) => (p >= size - 38 ? p % 5 === 0 : (p * (i + 3)) % 13 !== 0)),
);

/** Where each of those sets starts, named as the hover text names it. */
const WHOLE_SETS: MapSet[] = SET_SIZES.map((_, i) => {
  const set = String(14 - i);
  return {start: SET_SIZES.slice(0, i).reduce((sum, size) => sum + size, 0), label: `Set ${set}, ${SET_NAMES[set as SetCode]}`};
});

function LiveMap({pockets, sets, start = 2}: {pockets: Pocket[]; sets?: MapSet[]; start?: number}) {
  const [current, setCurrent] = useState(start);
  return <BinderSpreadMap pockets={pockets} current={current} onGo={setCurrent} sets={sets} />;
}

const meta: Meta<typeof LiveMap> = {
  title: 'Cards/BinderSpreadMap',
  component: LiveMap,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    // `binderWidth` is the map's own width, the binder's at 1920px unless a story says
    // otherwise; the padding goes around it.
    (Story, {parameters}) => (
      <div
        style={{
          width: (parameters.binderWidth ?? 1272) + 2 * SPACING.lg,
          padding: SPACING.lg,
          background: COLORS.background,
        }}>
        <Story />
      </div>
    ),
  ],
  args: {pockets: PART_COLLECTED},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The binder at 1920px wide: every spread at full size, the third on show. */
export const Default: Story = {};

/**
 * At 1440px the binder is 792px wide: eight spreads fit with their cells big enough to
 * show each gap, so even a set's binder shows a window, which moves at its edges.
 */
export const Narrow: Story = {
  parameters: {binderWidth: 792},
};

/** At 1280px the binder is 632px wide, and six spreads fit. */
export const Narrower: Story = {
  parameters: {binderWidth: 632},
};

/** The narrowest docked layout, 1024px with both panels open, leaves the binder about 376px: two spreads. */
export const Narrowest: Story = {
  parameters: {binderWidth: 376},
};

/** A finished set: every cell filled in its ink, nothing missing anywhere. */
export const Complete: Story = {
  args: {pockets: setPockets(207, () => true)},
};

/**
 * A set like 7 or 8, where about a third of the cards are dual-ink: each splits on the
 * diagonal, filled when held and ringed when missing.
 */
export const DualInkSet: Story = {
  args: {pockets: setPockets(224, (i) => i % 4 !== 0, 3)},
};

/**
 * Set 14's 242 pockets leave its last spread two cards, both on the left page: the right
 * page is the binder's inside back cover, tinted the cover's blue as the spread draws it.
 */
export const BackCover: Story = {
  args: {pockets: setPockets(242, (i) => i % 9 !== 0)},
};

/**
 * The whole collection: eleven spreads in view out of 135, each naming its sets on
 * hover. Reach the window's last spread and it becomes the first; step back past the
 * first and it becomes the last.
 */
export const WholeCollection: Story = {
  args: {pockets: WHOLE, sets: WHOLE_SETS, start: 20},
};

/** The whole collection at 1440px: a window of eight, moving at its edges as the wider one does. */
export const WholeCollectionNarrow: Story = {
  args: {pockets: WHOLE, sets: WHOLE_SETS, start: 20},
  parameters: {binderWidth: 792},
};
