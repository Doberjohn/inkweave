import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {BackLink} from './BackLink';

const meta: Meta<typeof BackLink> = {
  title: 'Components/BackLink',
  component: BackLink,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  // The `to` variant renders a react-router <Link>, which throws without a router.
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
};

export default meta;
type Story = StoryObj<typeof BackLink>;

/**
 * The common case: a real destination, so it renders an `<a>` and middle-click plus
 * open-in-new-tab work. The old button-only component could not express this, which
 * is why URL-based back links hand-rolled anchors and the pattern forked five ways.
 */
export const ToADestination: Story = {args: {to: '/decks', label: 'Back to decks'}};

/**
 * A handler instead, for reversing in-page state that has no URL of its own — the
 * expanded synergy group returning to the full list. Renders a `<button>`.
 */
export const ReversingInPageState: Story = {args: {onClick: fn(), label: 'Back to all synergies'}};
