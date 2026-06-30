import type {Meta, StoryObj} from '@storybook/react-vite';
import {SynergyPreviewPanel} from './SynergyPreviewPanel';
import type {SynergyGroup} from 'inkweave-synergy-engine';

const groups = [
  {groupKey: 'singer-songs', label: 'Singer + Songs', category: 'direct', tagline: '', description: '', synergies: [{}, {}]},
  {groupKey: 'ramp', label: 'Ramp', category: 'playstyle', tagline: '', description: '', synergies: [{}]},
] as unknown as SynergyGroup[];

const meta: Meta<typeof SynergyPreviewPanel> = {
  title: 'Reveal Admin/SynergyPreviewPanel',
  component: SynergyPreviewPanel,
};
export default meta;
type Story = StoryObj<typeof SynergyPreviewPanel>;

export const WithGroups: Story = {args: {groups}};
export const Empty: Story = {args: {groups: []}};
