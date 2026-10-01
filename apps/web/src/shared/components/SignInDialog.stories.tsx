import type {Meta, StoryObj} from '@storybook/react-vite';
import {SignInDialog} from './SignInDialog';
import {SessionProvider} from '../contexts/SessionContext';

// Wrapped in the real SessionProvider. Storybook has no Supabase env, so auth reports
// `enabled: false` and the provider buttons render disabled with the "not configured" note
// — a faithful view of the dialog in an unconfigured environment.
const meta: Meta<typeof SignInDialog> = {
  title: 'Shared/SignInDialog',
  component: SignInDialog,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <SessionProvider>
        <Story />
      </SessionProvider>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {args: {isOpen: true, onClose: () => undefined}};

export const Closed: Story = {args: {isOpen: false, onClose: () => undefined}};
