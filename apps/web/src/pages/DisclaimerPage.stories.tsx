import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {DisclaimerPage} from './DisclaimerPage';

const meta: Meta<typeof DisclaimerPage> = {
  title: 'Pages/DisclaimerPage',
  component: DisclaimerPage,
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
