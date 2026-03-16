import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {Chip} from './Chip';

const meta: Meta<typeof Chip> = {
  title: 'Components/Chip',
  component: Chip,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Toggle: Story = {
  args: {label: 'All', active: true, onClick: fn()},
};

export const ToggleInactive: Story = {
  args: {label: 'Shift', active: false, onClick: fn()},
};

export const Dismiss: Story = {
  render: () => <Chip variant="dismiss" label="Amber" onDismiss={fn()} />,
};

export const DismissMobile: Story = {
  render: () => <Chip variant="dismiss" label="Amber" onDismiss={fn()} isMobile />,
};

export const ToggleWithCount: Story = {
  render: () => (
    <Chip label="Payoff" active={true} onClick={fn()}>
      <span style={{fontSize: 10, opacity: 0.7}}>12</span>
    </Chip>
  ),
};

export const ToggleWithTooltip: Story = {
  args: {
    label: 'Tutor',
    active: false,
    onClick: fn(),
    title: 'Searches your deck or discard for location cards',
  },
};

export const ToggleGroup: Story = {
  render: function ToggleGroupStory() {
    const [active, setActive] = useState<string | null>(null);
    const chips = ['All', 'Payoff', 'Trigger', 'Buff', 'Tutor'];
    return (
      <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
        {chips.map((label) => (
          <Chip
            key={label}
            label={label}
            active={active === label || (active === null && label === 'All')}
            onClick={() => setActive(label === 'All' ? null : label)}
          />
        ))}
      </div>
    );
  },
};

export const DismissGroup: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
      <Chip variant="dismiss" label="Amber" onDismiss={fn()} />
      <Chip variant="dismiss" label="Character" onDismiss={fn()} />
      <Chip variant="dismiss" label="Cost 3" onDismiss={fn()} />
      <Chip variant="dismiss" label="Floodborn" onDismiss={fn()} />
    </div>
  ),
};
