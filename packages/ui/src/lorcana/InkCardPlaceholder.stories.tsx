import type {ReactNode} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink} from 'inkweave-synergy-engine';
import {RADIUS} from '../tokens/theme';
import {InkCardPlaceholder} from './InkCardPlaceholder';

const INKS: Ink[] = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

/** A card-shaped box to fill, as CardTile and CardImage give it: the placeholder covers its parent. */
function Frame({width, children}: {width: number; children: ReactNode}) {
  return (
    <div
      style={{
        position: 'relative',
        width,
        aspectRatio: '0.72',
        borderRadius: RADIUS.xl,
        overflow: 'hidden',
      }}>
      {children}
    </div>
  );
}

const meta: Meta<typeof InkCardPlaceholder> = {
  title: 'Components/InkCardPlaceholder',
  component: InkCardPlaceholder,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  // A Browse tile's width.
  render: (args) => (
    <Frame width={191}>
      <InkCardPlaceholder {...args} />
    </Frame>
  ),
};
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleInk: Story = {
  args: {ink: 'Amethyst'},
};

export const DualInk: Story = {
  args: {ink: 'Amethyst', ink2: 'Sapphire'},
};

/** No card known yet (its list is still loading): the neutral tile with the Inkweave mark. */
export const Neutral: Story = {
  args: {},
};

/** Every ink, then a dual-ink card and the neutral tile. */
export const AllInks: Story = {
  render: () => (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: 16, maxWidth: 1000}}>
      {INKS.map((ink) => (
        <Frame key={ink} width={140}>
          <InkCardPlaceholder ink={ink} />
        </Frame>
      ))}
      <Frame width={140}>
        <InkCardPlaceholder ink="Amber" ink2="Amethyst" />
      </Frame>
      <Frame width={140}>
        <InkCardPlaceholder />
      </Frame>
    </div>
  ),
};
