import type {Meta, StoryObj} from '@storybook/react-vite';
import {GithubTokenGate} from './GithubTokenGate';

const meta: Meta<typeof GithubTokenGate> = {
  title: 'Admin/GithubTokenGate',
  component: GithubTokenGate,
  args: {title: 'Card image admin', onSave: () => {}},
};
export default meta;

export const Default: StoryObj<typeof GithubTokenGate> = {};
