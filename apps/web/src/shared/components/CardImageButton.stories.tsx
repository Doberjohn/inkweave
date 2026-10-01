import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardImageButton} from './CardImageButton';
import {CardImage} from './CardImage';
import {RADIUS} from '../constants';

const meta: Meta<typeof CardImageButton> = {
  title: 'Shared/CardImageButton',
  component: CardImageButton,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Card art that opens its lightbox on click: the card page hero and each printing slide.
export const EnlargeableArt: Story = {
  args: {
    ariaLabel: 'Enlarge card image',
    onClick: () => {},
    borderRadius: RADIUS.xl,
    children: (
      <CardImage
        src="/card-images-preview/14023.avif"
        alt="Mickey Mouse - Best in Town"
        width={298}
        height={417}
        inkColor="Amber"
        cost={1}
        borderRadius={RADIUS.xl}
      />
    ),
  },
};

// No art to enlarge: the button stays operable but drops the pointer cursor.
export const WithoutArt: Story = {
  args: {
    ariaLabel: 'Enlarge card image',
    onClick: () => {},
    enlargeable: false,
    borderRadius: RADIUS.xl,
    children: (
      <CardImage
        src={undefined}
        alt="Mickey Mouse - Best in Town"
        width={298}
        height={417}
        inkColor="Amber"
        cost={1}
        borderRadius={RADIUS.xl}
      />
    ),
  },
};
