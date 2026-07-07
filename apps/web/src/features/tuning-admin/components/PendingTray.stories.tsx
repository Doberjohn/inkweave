import type {Meta, StoryObj} from '@storybook/react-vite';
import type {PendingEdit} from '../useTuningAdmin';
import {PendingTray} from './PendingTray';

function edit(p: Partial<PendingEdit>): PendingEdit {
  const path = p.path ?? ['ruleTexts', 'shift-targets', 'curve.gap3', 'score'];
  return {
    pathKey: JSON.stringify(path),
    path,
    value: 6,
    oldValue: 5,
    label: 'curve.gap3 · score',
    valid: true,
    ...p,
  };
}

const pending: PendingEdit[] = [
  edit({}),
  edit({
    path: ['playstyles', 'ramp', 'name'],
    label: 'Title · text',
    oldValue: 'Ramp',
    value: 'Ramp!',
  }),
];

const meta: Meta<typeof PendingTray> = {
  title: 'TuningAdmin/PendingTray',
  component: PendingTray,
  args: {
    pending,
    publishDisabled: false,
    publishing: false,
    result: null,
    error: null,
    onRevert: () => {},
    onClear: () => {},
    onPublish: () => {},
  },
};
export default meta;
type Story = StoryObj<typeof PendingTray>;

export const WithEdits: Story = {};

export const Empty: Story = {
  args: {pending: [], publishDisabled: true},
};

export const Invalid: Story = {
  args: {
    pending: [edit({valid: false, error: 'Score must be between 1 and 10', value: '11'})],
    publishDisabled: true,
  },
};

export const Publishing: Story = {
  args: {publishing: true, publishDisabled: true},
};

export const Published: Story = {
  args: {pending: [], result: {commitUrl: 'https://github.com/Doberjohn/inkweave/commit/abc123'}},
};

export const WithError: Story = {
  args: {error: 'Publish failed: 403 Forbidden'},
};
