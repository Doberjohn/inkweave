import type {Meta, StoryObj} from '@storybook/react-vite';
import {
  BinderChunkFallback,
  DockedSetBodyFallback,
  RowSetPickerFallback,
  ToolbarSetPickerFallback,
} from './BinderChunkFallback';
import {DockedSetPanel} from '../cards/components/BrowseSidePanel';
import {COLORS, SPACING} from '../../shared/constants';

/**
 * What collection mode draws while the binder's chunk downloads (#913): the binder section in
 * its own box, a spread on desktop and a page on a phone, plus the small placeholders that hold
 * the docked set panel's body, the toolbar's set picker and a phone row's (#969).
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
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** At 1024 px and up the section is the docked binder's: one spread. */
export const Desktop: Story = {};

/**
 * A phone (#969): the board of the page the binder will draw, and the empty band its map takes
 * under it. In this 800px box a 320px phone's page has four rows (#1000).
 */
export const Mobile: Story = {
  globals: {viewport: {value: 'mobile1'}},
};

/** A short phone's section, 440px: the page keeps three rows, as wide as the section lets it be. */
export const MobileThreeRows: Story = {
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
