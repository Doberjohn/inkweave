import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {ReleaseNotesPage} from './ReleaseNotesPage';

const meta: Meta<typeof ReleaseNotesPage> = {
  title: 'Pages/ReleaseNotesPage',
  component: ReleaseNotesPage,
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

export const Default: Story = {};

export const Mobile: Story = {
  globals: {viewport: {value: 'mobile1'}},
};
