import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardImageButton} from './CardImageButton';
import {InkCardPlaceholder} from './InkCardPlaceholder';
import {RADIUS} from '../tokens/theme';

// The app wraps its CardImage, which stays in the app until #980: the art and a placeholder of
// the hero's size stand in for it here.
const ART = {width: 298, height: 417, borderRadius: RADIUS.xl};

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
      <img
        src="/card-images-preview/14023.avif"
        alt="Mickey Mouse - Best in Town"
        width={ART.width}
        height={ART.height}
        style={{display: 'block', borderRadius: ART.borderRadius}}
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
      <span style={{...ART, display: 'block', position: 'relative'}}>
        <InkCardPlaceholder ink="Amber" />
      </span>
    ),
  },
};
