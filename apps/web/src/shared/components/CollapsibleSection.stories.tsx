import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {CollapsibleSection} from './CollapsibleSection';
import {COLORS} from '../constants';

const meta: Meta<typeof CollapsibleSection> = {
  title: 'Components/CollapsibleSection',
  component: CollapsibleSection,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

const SampleContent = () => (
  <div style={{color: COLORS.text, fontSize: 13}}>
    <p style={{margin: '0 0 8px'}}>This is the collapsible content area.</p>
    <p style={{margin: 0}}>It can contain any React nodes.</p>
  </div>
);

export const Expanded: Story = {
  args: {
    title: 'Ink Colors',
    collapsed: false,
    children: <SampleContent />,
  },
};

export const Collapsed: Story = {
  args: {
    title: 'Ink Colors',
    collapsed: true,
    children: <SampleContent />,
  },
};

export const WithBadge: Story = {
  args: {
    title: 'Card Types',
    collapsed: false,
    badge: (
      <span
        style={{
          background: COLORS.primary,
          color: '#000',
          borderRadius: 8,
          padding: '1px 6px',
          fontSize: 10,
          fontWeight: 700,
        }}>
        4
      </span>
    ),
    children: <SampleContent />,
  },
};

export const Interactive: Story = {
  render: () => {
    const [collapsed, setCollapsed] = useState(false);
    return (
      <div style={{width: 300}}>
        <CollapsibleSection
          title="Synergy Groups"
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}>
          <SampleContent />
        </CollapsibleSection>
      </div>
    );
  },
};
