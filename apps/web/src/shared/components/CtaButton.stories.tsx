import type {Meta, StoryObj} from '@storybook/react-vite';
import {CtaButton} from './CtaButton';

const meta: Meta<typeof CtaButton> = {
  title: 'Shared/CtaButton',
  component: CtaButton,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Filled: Story = {
  args: {children: 'Browse all cards'},
};

export const Ghost: Story = {
  args: {variant: 'ghost', children: 'Explore playstyles'},
};

export const FilledWithIcon: Story = {
  args: {
    children: (
      <>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
            fill="#0f172b"
            stroke="#0f172b"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        Return to Inkweave
      </>
    ),
  },
};
