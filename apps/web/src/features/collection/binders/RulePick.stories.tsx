import type {Meta, StoryObj} from '@storybook/react-vite';
import {useState} from 'react';
import {within} from 'storybook/test';
import {COLORS, SPACING} from '../../../shared/constants';
import {RulePick} from './RulePick';

const CLASSIFICATIONS = ['Alien', 'Ally', 'Dreamborn', 'Floodborn', 'Hero', 'Inventor', 'King', 'Mentor', 'Princess', 'Queen', 'Storyborn', 'Villain'];

interface PickProps {
  /** What is picked when the story opens. */
  start: string[];
  isMobile: boolean;
}

/** The dropdown keeping its own picks, as the window's draft does, at a line's width. */
function StoryPick({start, isMobile}: PickProps) {
  const [picked, setPicked] = useState(start);
  return (
    // Room under the field for the list it opens.
    <div style={{width: isMobile ? 358 : 468, minHeight: 360, padding: SPACING.xl, background: COLORS.surface}}>
      <RulePick label="Classification" options={CLASSIFICATIONS} picked={picked} onChange={setPicked} isMobile={isMobile} />
    </div>
  );
}

/**
 * A rule line's dropdown, Classification or Keyword: the picks as chips in the field, each with
 * its ×, and a button that opens the pool's options with a find field on top. A pick stays in the
 * list, ticked.
 */
const meta: Meta<typeof StoryPick> = {
  title: 'Collection/Binders/RulePick',
  component: StoryPick,
  tags: ['autodocs'],
  args: {start: [], isMobile: false},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing picked: Any classification. */
export const Closed: Story = {};

/** Open on its find field, its first option highlighted. Opened in this story's own canvas. */
export const Open: Story = {
  args: {start: ['Hero']},
  play: ({canvasElement}) => {
    within(canvasElement).getByRole('button', {name: 'Add a classification'}).click();
  },
};

/** Three picks as chips, then Add a classification. */
export const ThreePicks: Story = {args: {start: ['Hero', 'Princess', 'Storyborn']}};

/** On a phone, at the kit's touch size. */
export const Phone: Story = {
  args: {start: ['Hero', 'Villain'], isMobile: true},
  globals: {viewport: {value: 'mobile1'}},
};
