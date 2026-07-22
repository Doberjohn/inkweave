import type {Meta, StoryObj} from '@storybook/react-vite';
import {WhatsNewSection} from './WhatsNewSection';

const meta: Meta<typeof WhatsNewSection> = {
  title: 'Features/Reveals/WhatsNewSection',
  component: WhatsNewSection,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{maxWidth: 1180, margin: '0 auto'}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
  args: {compact: true},
  decorators: [
    (Story) => (
      <div style={{maxWidth: 390, margin: '0 auto'}}>
        <Story />
      </div>
    ),
  ],
};
