import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {Breadcrumb} from './Breadcrumb';

const meta: Meta<typeof Breadcrumb> = {
  title: 'Shared/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The app's one real trail: a playstyle sits two levels down. */
export const TwoLevels: Story = {
  args: {crumbs: [{label: 'Playstyles', to: '/playstyles'}, {label: 'Lore Denial'}]},
};

/**
 * Deeper. Every ancestor links, the last one never does — you are already there, and
 * a link to the current page is a dead control that still looks pressable.
 */
export const ThreeLevels: Story = {
  args: {crumbs: [{label: 'Playstyles', to: '/playstyles'}, {label: 'Lore Denial', to: '/playstyles/lore-denial'}, {label: 'All cards'}]},
};
