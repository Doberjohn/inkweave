import type {Meta, StoryObj} from '@storybook/react-vite';
import {BinderChunkFallback, DockedSetBodyFallback, ToolbarSetPickerFallback} from './BinderChunkFallback';
import {DockedSetPanel} from '../cards/components/BrowseSidePanel';
import {COLORS, SPACING} from '../../shared/constants';

/**
 * What collection mode draws while the binder's chunk downloads (#913): the binder section in
 * its own box, a spread on desktop and the set strip over a page on a phone, plus the two small
 * placeholders that hold the docked set panel's body and the toolbar's set picker.
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

/** A phone: the set strip's picker and segments, then one page. */
export const Mobile: Story = {
  globals: {viewport: {value: 'mobile1'}},
};

/**
 * The docked panel's body in the panel itself (what the binder shows, then the numbers' loading
 * shape filling the rest), and the toolbar's set picker at its slot's width.
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
    </div>
  ),
};
