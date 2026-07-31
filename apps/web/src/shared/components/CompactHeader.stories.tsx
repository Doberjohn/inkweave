import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {CompactHeader} from './CompactHeader';
import {SessionProvider} from '../contexts/SessionContext';

const meta: Meta<typeof CompactHeader> = {
  title: 'Components/CompactHeader',
  component: CompactHeader,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // CompactHeader renders auth (HeaderAuth), so it now genuinely requires a
      // SessionProvider — useSession throws without one. Storybook-safe: with no
      // Supabase env the provider yields enabled:false and resolves loading at once.
      //
      // NOTE the auth control's rendered state here is ENVIRONMENT-DEPENDENT.
      // Storybook runs on Vite and loads .env.local exactly as the app does, so on
      // a configured machine this shows "Sign in" and on CI it shows nothing.
      // These stories are not the review surface for that control; the running app
      // is, since a signed-in session cannot exist anywhere else.
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

export const Mobile: Story = {
  args: {isMobile: true},
};

export const MobileWithBackArrow: Story = {
  args: {isMobile: true, showBackArrow: true},
};
