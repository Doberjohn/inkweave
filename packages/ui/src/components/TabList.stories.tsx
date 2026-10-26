import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {TabList} from './TabList';

const meta: Meta<typeof TabList> = {
  title: 'Shared/TabList',
  component: TabList,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

function Demo({tabs}: {tabs: ReadonlyArray<{id: string; label: string}>}) {
  const [active, setActive] = useState(tabs[0].id);
  return <TabList tabs={tabs} active={active} onChange={setActive} ariaLabel="Demo views" />;
}

// The unified underline tabs: DeckPanel's visual ruling (text-color active +
// gold underline) with the full ARIA tablist keyboard behavior. Arrow keys
// move focus AND selection, wrapping at the ends.
export const TwoTabs: Story = {
  render: () => <Demo tabs={[{id: 'cards', label: 'Cards'}, {id: 'analysis', label: 'Analysis'}]} />,
};

export const ThreeTabs: Story = {
  render: () => (
    <Demo
      tabs={[
        {id: 'calibration', label: 'Calibration'},
        {id: 'activity', label: 'Activity'},
        {id: 'webAnalytics', label: 'Web Analytics'},
      ]}
    />
  ),
};
