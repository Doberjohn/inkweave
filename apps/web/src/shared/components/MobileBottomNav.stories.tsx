import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {MobileBottomNav} from './MobileBottomNav';

const meta: Meta<typeof MobileBottomNav> = {
  title: 'Components/MobileBottomNav',
  component: MobileBottomNav,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const BrowseActive: Story = {
  args: {onSearchClick: fn()},
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/browse']}>
        <div style={{height: '200px', position: 'relative'}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};

export const PlaystylesActive: Story = {
  args: {onSearchClick: fn()},
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/playstyles']}>
        <div style={{height: '200px', position: 'relative'}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};

export const HomeActive: Story = {
  args: {onSearchClick: fn()},
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <div style={{height: '200px', position: 'relative'}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};
