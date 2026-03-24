import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CardPreviewProvider} from '../../features/cards/components/CardPreviewProvider';
import {HeroSection} from './HeroSection';

const meta: Meta<typeof HeroSection> = {
  title: 'Components/HeroSection',
  component: HeroSection,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <CardPreviewProvider>
        <Story />
      </CardPreviewProvider>
    ),
  ],
  args: {
    searchQuery: '',
    onSearchChange: fn(),
    onSearchSubmit: fn(),
    onBrowse: fn(),
    onPlaystyles: fn(),
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: {},
};

export const Mobile: Story = {
  args: {isMobile: true},
};

export const WithSearchText: Story = {
  args: {searchQuery: 'Elsa'},
};
