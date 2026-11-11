import type {PageSide} from '../../cards/components/binderGeometry';
import {PickDialog, usePickSave} from './binderDialogs';
import {setMyCollection} from './binderShelf';
import {PagesChoices} from './PagesChoices';
import {MY_COLLECTION} from './shelfWords';

export interface PagesPickerProps {
  isOpen: boolean;
  /** My collection's page as the shelf holds it, pockets a side. */
  pages: PageSide;
  /** Whose shelf: the save waits in their write queue. */
  readerId: string;
  isMobile: boolean;
  /** Told once the server has the size; the caller closes the picker. */
  onSaved: () => void;
  onClose: () => void;
  /** Told once a closed picker's exit has run, so the shelf can unmount it. */
  onGone: () => void;
}

const FAILED_WORDS = "Couldn't change the page size. Try again.";

/** The pick, and what it came to (`usePickSave`): My collection's size, on its shelf row. */
function usePagesSave({readerId, onSaved}: Pick<PagesPickerProps, 'readerId' | 'onSaved'>) {
  const save = async (pages: PageSide): Promise<'set' | 'failed'> =>
    (await setMyCollection({readerId, patch: {pages}})) ? 'set' : 'failed';
  return usePickSave(save, 'pages', onSaved);
}

/**
 * Pages, from My collection's ⋯ on the shelf: its three sizes, 2 × 2 to 4 × 4, its own
 * ringed and marked. A binder of your own changes its size in the window, beside its rules. A pick
 * saves at once and closes the picker once it lands; picking the size it has already only closes.
 * A failure keeps it open and says so. A dialog on a computer and a tablet, a sheet on a phone.
 *
 * Lazy, in a chunk of its own, and only with binders on (`flag.ts`).
 */
export function PagesPicker(props: PagesPickerProps) {
  const save = usePagesSave(props);
  const pick = (pages: PageSide) => {
    if (pages === props.pages) props.onSaved();
    else void save.pick(pages);
  };
  return (
    <PickDialog
      isOpen={props.isOpen}
      isMobile={props.isMobile}
      size="sm"
      dialogName="Pages"
      title={`Pages for ${MY_COLLECTION}`}
      lead="Pick how many cards a page holds."
      saving={save.saving}
      problem={save.problem}
      failedWords={FAILED_WORDS}
      onClose={props.onClose}
      onGone={props.onGone}>
      <PagesChoices chosen={props.pages} onPick={pick} disabled={save.saving} />
    </PickDialog>
  );
}
