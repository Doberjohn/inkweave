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
      // CompactHeader renders auth (HeaderAuth) when VITE_SHOW_ACCOUNTS is on, and
      // AuthButton calls useSession, which throws outside a provider. The decorator is
      // therefore required whenever the flag is on, and harmless when it is off.
      //
      // TO REVIEW THE AUTH CONTROL HERE you need `VITE_SHOW_ACCOUNTS=true` in
      // .env.local: Storybook runs on Vite and loads it exactly as the app does. With
      // the shipped default (off) these stories show the header WITHOUT the control,
      // which is what production renders today.
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

export const Mobile: Story = {
  args: {isMobile: true},
};

export const MobileWithBackArrow: Story = {
  args: {isMobile: true, showBackArrow: true},
};
