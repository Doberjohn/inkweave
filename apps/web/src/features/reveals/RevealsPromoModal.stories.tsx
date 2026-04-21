import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {RevealsPromoModal} from './RevealsPromoModal';

const meta: Meta<typeof RevealsPromoModal> = {
  title: 'Features/Reveals/RevealsPromoModal',
  component: RevealsPromoModal,
  parameters: {layout: 'fullscreen', backgrounds: {default: 'dark'}},
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
  beforeEach: () => {
    // Ensure the modal is not suppressed by a same-day dismiss from a prior story.
    try {
      localStorage.removeItem('inkweave:reveals-modal-dismissed');
    } catch {
      /* localStorage may be disabled in some preview envs */
    }
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AboveMobileNav: Story = {args: {bottomOffset: 116}};
