import type {Meta, StoryObj} from '@storybook/react-vite';
import {useState} from 'react';
import {RuleSelector} from './RuleSelector';

const meta: Meta<typeof RuleSelector> = {
  title: 'TuningAdmin/RuleSelector',
  component: RuleSelector,
};
export default meta;
type Story = StoryObj<typeof RuleSelector>;

function Harness({initial}: {initial: string | null}) {
  const [selectedId, setSelectedId] = useState<string | null>(initial);
  return (
    <div style={{maxWidth: 240}}>
      <RuleSelector selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  );
}

export const Default: Story = {render: () => <Harness initial={null} />};

export const WithSelection: Story = {render: () => <Harness initial="ramp" />};
