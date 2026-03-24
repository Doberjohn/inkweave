import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {CardPreviewProvider} from '../../features/cards/components/CardPreviewProvider';
import {CompactHeader} from './CompactHeader';

const meta: Meta<typeof CompactHeader> = {
  title: 'Components/CompactHeader',
  component: CompactHeader,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/browse']}>
        <CardPreviewProvider>
          <Story />
        </CardPreviewProvider>
      </MemoryRouter>
    ),
  ],
  args: {onLogoClick: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithBackArrow: Story = {
  args: {showBackArrow: true},
};

export const WithSearch: Story = {
  args: {
    searchQuery: '',
    onSearchChange: fn(),
    onSearchSubmit: fn(),
  },
};

export const Mobile: Story = {
  args: {isMobile: true},
};

export const MobileWithBackArrow: Story = {
  args: {isMobile: true, showBackArrow: true},
};
