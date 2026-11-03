import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn, within} from 'storybook/test';
import {CompactHeader} from './CompactHeader';
import {SessionProvider} from '../contexts/SessionContext';

const meta: Meta<typeof CompactHeader> = {
  title: 'Components/CompactHeader',
  component: CompactHeader,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // CompactHeader renders auth (HeaderAuth), and AuthButton calls useSession, which
      // throws outside a provider, so every story needs the provider.
      <MemoryRouter initialEntries={['/browse']}>
        <SessionProvider>
          <Story />
        </SessionProvider>
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

/**
 * The skip link (WCAG 2.4.1), shown while it has focus: the first Tab stop on every page with the
 * header. Focused in this story's own canvas, since the docs page renders every story in one page.
 */
export const SkipLinkFocused: Story = {
  play: ({canvasElement}) => {
    within(canvasElement).getByRole('link', {name: 'Skip to main content'}).focus();
  },
};

export const Mobile: Story = {
  args: {isMobile: true},
};

export const MobileWithBackArrow: Story = {
  args: {isMobile: true, showBackArrow: true},
};
