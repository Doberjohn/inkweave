import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardImage} from './CardImage';

const meta: Meta<typeof CardImage> = {
  title: 'Components/CardImage',
  component: CardImage,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    inkColor: {
      control: 'select',
      options: ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: 'https://lorcana-api.com/images/tfc/1/en/full.webp',
    alt: 'Elsa - Snow Queen',
    width: 120,
    height: 168,
    inkColor: 'Sapphire',
    cost: 5,
  },
};

export const WithoutImage: Story = {
  args: {
    src: undefined,
    alt: 'Missing image',
    width: 120,
    height: 168,
    inkColor: 'Amber',
    cost: 3,
  },
};

export const SmallSize: Story = {
  args: {
    src: 'https://lorcana-api.com/images/tfc/1/en/full.webp',
    alt: 'Small card',
    width: 60,
    height: 84,
    inkColor: 'Ruby',
    cost: 2,
  },
};

export const LargeSize: Story = {
  args: {
    src: 'https://lorcana-api.com/images/tfc/1/en/full.webp',
    alt: 'Large card',
    width: 200,
    height: 280,
    inkColor: 'Emerald',
    cost: 7,
  },
};

export const AllInkColors: Story = {
  render: () => (
    <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
      {(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'] as const).map((ink) => (
        <div key={ink} style={{textAlign: 'center'}}>
          <CardImage src={undefined} alt={ink} width={80} height={112} inkColor={ink} cost={4} />
          <div style={{marginTop: '8px', fontSize: '12px'}}>{ink}</div>
        </div>
      ))}
    </div>
  ),
};
