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
