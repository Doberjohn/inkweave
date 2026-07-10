import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {Footer} from './Footer';

const meta: Meta<typeof Footer> = {
  title: 'Components/Footer',
  component: Footer,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The footer on its own, as it renders at the bottom of a page. */
export const Default: Story = {};

/** In context: pinned below scrollable content (Home and the legal pages). */
export const OnPage: Story = {
  decorators: [
    (Story) => (
      <div style={{minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
        <div
          style={{
            flex: 1,
            padding: 40,
            color: '#90a1b9',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
          Page content goes here.
        </div>
        <Story />
      </div>
    ),
  ],
};
