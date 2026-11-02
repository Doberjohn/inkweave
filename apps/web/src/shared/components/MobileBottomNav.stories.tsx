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

const withRouter = (path: string) => (Story: () => React.ReactNode) => (
  <MemoryRouter initialEntries={[path]}>
    <div style={{height: 200, position: 'relative'}}>
      <Story />
    </div>
  </MemoryRouter>
);

export const FlatBrowseActive: Story = {
  args: {onSearchClick: fn(), phaseOverride: 'hidden'},
  decorators: [withRouter('/browse')],
};

export const FlatPlaystylesActive: Story = {
  args: {onSearchClick: fn(), phaseOverride: 'hidden'},
  decorators: [withRouter('/playstyles')],
};

export const FlatVoteActive: Story = {
  args: {onSearchClick: fn(), phaseOverride: 'hidden'},
  decorators: [withRouter('/vote')],
};

export const RevealSeasonBrowseActive: Story = {
  args: {onSearchClick: fn(), phaseOverride: 'pre-release'},
  decorators: [withRouter('/browse')],
};

export const RevealSeasonRevealsActive: Story = {
  args: {onSearchClick: fn(), phaseOverride: 'pre-release-live'},
  decorators: [withRouter('/reveals')],
};

/** Accounts on, signed out: the account tab is Sign in, which opens the sign-in dialog in the app. */
export const AccountSignedOut: Story = {
  args: {onSearchClick: fn(), phaseOverride: 'hidden', accountOverride: 'sign-in'},
  decorators: [withRouter('/browse')],
};

/** Signed in, on the account page: the account tab lights up. */
export const AccountSignedInActive: Story = {
  args: {onSearchClick: fn(), phaseOverride: 'hidden', accountOverride: 'account'},
  decorators: [withRouter('/account')],
};

/** Reveal season with the account tab: six tabs. */
export const RevealSeasonAccountActive: Story = {
  args: {onSearchClick: fn(), phaseOverride: 'pre-release', accountOverride: 'account'},
  decorators: [withRouter('/account')],
};
