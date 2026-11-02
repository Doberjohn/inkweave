import type {Meta, StoryObj} from '@storybook/react-vite';
import {BetaNotice} from './BetaNotice';

/*
 * index.css's `.beta-notice` lays the card out by the screen's width: in the top-left corner
 * from 1400 px, a wide card above the logo from 768 px, a stacked one below that. The column
 * stands in for the home page's frame, which the card sits at the top of.
 */
const meta: Meta<typeof BetaNotice> = {
  title: 'Shared/BetaNotice',
  component: BetaNotice,
  parameters: {layout: 'fullscreen'},
  decorators: [
    (Story) => (
      <div style={{position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** At the window's own width: the corner card on a wide screen. */
export const Default: Story = {};

/** A tablet's width: the wide card, its button on the right. */
export const Tablet: Story = {
  globals: {viewport: {value: 'tablet'}},
};

/** A phone's width: the stacked card, its button full width. */
export const Phone: Story = {
  globals: {viewport: {value: 'mobile1'}},
};
