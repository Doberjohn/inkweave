import type {Meta, StoryObj} from '@storybook/react-vite';
import {
  BinderChunkFallback,
  DockedSetBodyFallback,
  RowSetPickerFallback,
  ToolbarSetPickerFallback,
} from './BinderChunkFallback';
import {DockedSetPanel} from '../cards/components/BrowseSidePanel';
import {TODAY_PAGE, squarePage} from '../cards/components/binderGeometry';
import {COLORS, SPACING} from '../../shared/constants';

/**
 * What collection mode draws while the binder's chunk downloads (#913): the binder section in
 * its own box, a spread on desktop and a page on a phone, each of the binder's page size, plus
 * the small placeholders that hold the docked set panel's body, the toolbar's set picker and a
 * phone row's (#969).
 */
const meta: Meta<typeof BinderChunkFallback> = {
  title: 'Collection/BinderChunkFallback',
  component: BinderChunkFallback,
  decorators: [
    (Story) => (
      <div style={{height: 800, background: COLORS.background}}>
        <Story />
      </div>
    ),
  ],
  args: {grid: squarePage(4)},
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** At 1024 px and up the section is the docked binder's: one spread, of two 4 by 4 pages. */
export const Desktop: Story = {};

/** A phone: the board of the 4 by 4 page the binder will draw, and the empty band its map takes under it. */
export const Mobile: Story = {
  globals: {viewport: {value: 'mobile1'}},
};

/** A 2 by 2 binder's page on a phone: the band under it holds a mini of two rows. */
export const MobileTwoByTwo: Story = {
  args: {grid: squarePage(2)},
  globals: {viewport: {value: 'mobile1'}},
};

/** Today's 4 by 3 page, which binders off keep: one spread of two pages, each about square. */
export const TodayDesktop: Story = {
  args: {grid: TODAY_PAGE},
};

/** Today's page on a phone, 3 across: in this 800px box a 320px phone's page has four rows. */
export const TodayMobile: Story = {
  args: {grid: TODAY_PAGE},
  globals: {viewport: {value: 'mobile1'}},
};

/** Today's page in a short phone's section, 440px: it keeps three rows, as wide as the section lets it be. */
export const TodayMobileThreeRows: Story = {
  args: {grid: TODAY_PAGE},
  globals: {viewport: {value: 'mobile1'}},
  decorators: [
    (Story) => (
      <div style={{height: 440}}>
        <Story />
      </div>
    ),
  ],
};

/**
 * The docked panel's body in the panel itself (what the binder shows, then the numbers' loading
 * shape filling the rest), the toolbar's set picker at its slot's width, and a phone row's at
 * an iPhone 15's (#969).
 */
export const PanelAndPicker: Story = {
  render: () => (
    <div style={{display: 'flex', alignItems: 'flex-start', gap: SPACING.lg, padding: SPACING.lg}}>
      <div style={{height: 420}}>
        <DockedSetPanel>
          <DockedSetBodyFallback />
        </DockedSetPanel>
      </div>
      <div style={{width: 111}}>
        <ToolbarSetPickerFallback />
      </div>
      <div style={{width: 164}}>
        <RowSetPickerFallback />
      </div>
    </div>
  ),
};
