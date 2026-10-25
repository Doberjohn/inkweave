import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {BinderShows, type BinderView} from './BinderShows';
import type {BinderShow} from './binderCards';
import {SIDE_PANEL_STYLE} from '../cards/components/BrowseSidePanel';

/** What the binder shows, live: press All, Owned or Missing and it is the chosen one. */
function LiveShows({show, onShowChange}: BinderView) {
  const [chosen, setChosen] = useState<BinderShow>(show);
  // A new `show` from the Controls panel replaces the one picked here.
  const [argShow, setArgShow] = useState(show);
  if (show !== argShow) {
    setArgShow(show);
    setChosen(show);
  }
  const choose = (next: BinderShow) => {
    setChosen(next);
    onShowChange(next);
  };
  return <BinderShows show={chosen} onShowChange={choose} />;
}

/** All, Owned or Missing, in the side panels' surface the set panel lives on. */
const meta: Meta<typeof LiveShows> = {
  title: 'Collection/BinderShows',
  component: LiveShows,
  decorators: [
    (Story) => (
      <div style={SIDE_PANEL_STYLE}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {show: 'all', onShowChange: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Every card, the binder's resting view. */
export const All: Story = {};

/** The cards you hold. */
export const Owned: Story = {args: {show: 'owned'}};

/** The cards you are missing. */
export const Missing: Story = {args: {show: 'missing'}};
