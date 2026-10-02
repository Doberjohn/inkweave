import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {MemoryRouter} from 'react-router-dom';
import {AuthButton} from './AuthButton';
import {SessionProvider} from '../contexts/SessionContext';

const meta: Meta<typeof AuthButton> = {
  title: 'Components/AuthButton',
  component: AuthButton,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      // useSession throws without a provider. Storybook-safe: with no Supabase env
      // the provider yields enabled:false and resolves loading at once.
      //
      // What renders here is ENVIRONMENT-DEPENDENT, same caveat as CompactHeader's
      // stories. Storybook runs on Vite and loads .env.local exactly as the app
      // does, so a configured machine shows "Sign in" and CI shows nothing at all.
      // The signed-in "Sign out" state cannot be staged here, because a real
      // session cannot exist outside the running app. The app is the review
      // surface for that one.
      // AuthButton calls useNavigate() unconditionally, which throws outside a Router.
      // The global preview decorator only sets a background, so each story supplies its
      // own, as the other router-dependent stories in this repo do.
      <MemoryRouter>
        <SessionProvider>
          <Story />
        </SessionProvider>
      </MemoryRouter>
    ),
  ],
  args: {onSignIn: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
