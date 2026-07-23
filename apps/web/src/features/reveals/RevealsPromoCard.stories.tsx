import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {RevealsPromoCard} from './RevealsPromoCard';

const meta: Meta<typeof RevealsPromoCard> = {
  title: 'Features/Reveals/RevealsPromoCard',
  component: RevealsPromoCard,
  parameters: {layout: 'fullscreen'},
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{position: 'relative', minHeight: '100vh'}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
