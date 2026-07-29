import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../constants';
import {PageTitle} from './PageTitle';

const meta: Meta<typeof PageTitle> = {
  title: 'Shared/PageTitle',
  component: PageTitle,
  decorators: [
    (Story) => (
      <div style={{background: COLORS.background, padding: 16, width: 420}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {args: {children: 'Browse Cards'}};

// Pages own their own spacing; the component only fixes the typography.
export const WithPagePadding: Story = {
  args: {children: 'Deck Builder', style: {padding: '24px 32px 0', margin: 0}},
};

// PlaystyleDetail sits inside an accent-colored header and inherits its color.
export const InheritingColor: Story = {
  args: {children: 'Lore Denial', style: {margin: 0, color: 'inherit'}},
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, color: COLORS.primary, padding: 16}}>
        <Story />
      </div>
    ),
  ],
};
