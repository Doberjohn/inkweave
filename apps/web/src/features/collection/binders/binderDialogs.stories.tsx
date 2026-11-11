import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {DIALOG_TITLE} from '../../../shared/constants';
import {AskDialog, NameField, PickDialog, ProblemLine, type SaveProblem} from './binderDialogs';
import {PagesChoices} from './PagesChoices';

/**
 * What the binder dialogs share: a small dialog that is a sheet on a phone (`AskDialog`), the
 * Name field, filled in and selected the first time it takes focus, and the line a save that
 * didn't land says over the buttons (`ProblemLine`): the shelf full, the binder gone, or a failure.
 * Change cover and Pages share a pick dialog (`PickDialog`), whose pick saves at once.
 */
function Ask({isMobile, problem}: {isMobile: boolean; problem: SaveProblem | null}) {
  const [name, setName] = useState('Amber');
  return (
    <AskDialog isOpen isMobile={isMobile} onClose={fn()} dialogName="Rename binder" size="sm">
      <h2 style={DIALOG_TITLE}>Rename binder</h2>
      <NameField value={name} onChange={setName} disabled={false} />
      <ProblemLine problem={problem} style={{marginTop: 12}} />
    </AskDialog>
  );
}

const meta: Meta<typeof Ask> = {
  title: 'Collection/Binders/binderDialogs',
  component: Ask,
  tags: ['autodocs'],
  args: {isMobile: false, problem: null},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A computer's dialog with the Name field. */
export const Dialog: Story = {};

/** The shelf was full. */
export const Full: Story = {args: {problem: 'full'}};

/** The binder was deleted on another device. */
export const Gone: Story = {args: {problem: 'gone'}};

/** The save failed. */
export const Failed: Story = {args: {problem: 'failed'}};

/** A phone's sheet. */
export const Phone: Story = {args: {isMobile: true}, globals: {viewport: {value: 'mobile1'}}};

/** A pick dialog while its pick saves: the choices and Cancel wait. */
export const PickSaving: Story = {
  render: () => (
    <PickDialog
      isOpen
      isMobile={false}
      size="sm"
      dialogName="Pages"
      title="Pages for My collection"
      lead="Pick how many cards a page holds."
      saving
      problem={null}
      failedWords="Couldn't change the page size. Try again."
      onClose={fn()}
      onGone={fn()}>
      <PagesChoices chosen={3} onPick={fn()} disabled />
    </PickDialog>
  ),
};

/** A pick dialog after a pick that didn't land. */
export const PickFailed: Story = {
  render: () => (
    <PickDialog
      isOpen
      isMobile={false}
      size="sm"
      dialogName="Pages"
      title="Pages for My collection"
      lead="Pick how many cards a page holds."
      saving={false}
      problem="failed"
      failedWords="Couldn't change the page size. Try again."
      onClose={fn()}
      onGone={fn()}>
      <PagesChoices chosen={4} onPick={fn()} disabled={false} />
    </PickDialog>
  ),
};
