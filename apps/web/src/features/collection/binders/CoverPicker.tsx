import {useState} from 'react';
import {trackEvent} from '../../../shared/lib/analytics';
import {PickDialog} from './binderDialogs';
import type {Binder} from './binderRules';
import {setCover, type CoverResult} from './binderShelf';
import {CoverChoices} from './CoverChoices';
import {coverDesign, sameCover, type CoverDesign} from './coverDesigns';
import {MY_COLLECTION} from './shelfWords';

export interface CoverPickerProps {
  isOpen: boolean;
  /** The binder whose cover changes, or null for My collection. Kept while the picker closes. */
  binder: Binder | null;
  /** My collection's cover as the shelf holds it: a design's id, or null for the first. */
  myCover: string | null;
  /** Whose shelf: the save waits in their write queue. */
  readerId: string;
  isMobile: boolean;
  /** Told once the server has the cover; the caller closes the picker. */
  onSaved: () => void;
  onClose: () => void;
  /** Told once a closed picker's exit has run, so the shelf can unmount it. */
  onGone: () => void;
}

/** What the picker is called: our words, never the binder's name, which stays out of attributes. */
const DIALOG_NAME = 'Change cover';

/** Why a pick didn't land. */
type CoverProblem = Exclude<CoverResult, 'set'>;

const FAILED_WORDS = "Couldn't change the cover. Try again.";

/**
 * The pick, and what it came to. While it runs every way out waits, since the picker alone would
 * say it failed.
 */
function useCoverSave({readerId, binder, onSaved}: Pick<CoverPickerProps, 'readerId' | 'binder' | 'onSaved'>) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<CoverProblem | null>(null);
  const pick = async (design: CoverDesign) => {
    setSaving(true);
    setProblem(null);
    const result = await setCover({readerId, id: binder?.id ?? null, cover: design.id});
    setSaving(false);
    if (result !== 'set') {
      setProblem(result);
      return;
    }
    trackEvent('binder_changed', {what: 'cover'});
    onSaved();
  };
  return {saving, problem, pick};
}

/**
 * Change cover, from a cover's ⋯ on the shelf: "Cover for Amber", or for My collection, then the
 * eight designs, four across with their names, the binder's own ringed and marked. A pick saves
 * at once and closes the picker once it lands; picking the design it has already only closes. A
 * failure keeps it open and says so. A dialog on a computer and a tablet, a sheet on a phone.
 *
 * Lazy, in a chunk of its own, and only with binders on (`flag.ts`). It carries `ph-no-capture`:
 * the title is the player's own words.
 */
export function CoverPicker(props: CoverPickerProps) {
  const {binder} = props;
  const save = useCoverSave(props);
  const own = binder === null ? props.myCover : binder.cover;
  const chosen = coverDesign(own);
  const pick = (design: CoverDesign) => {
    if (sameCover(design.id, own)) props.onSaved();
    else void save.pick(design);
  };
  return (
    <PickDialog
      isOpen={props.isOpen}
      isMobile={props.isMobile}
      size="md"
      dialogName={DIALOG_NAME}
      title={`Cover for ${binder?.name ?? MY_COLLECTION}`}
      lead="Pick its cover."
      saving={save.saving}
      problem={save.problem}
      failedWords={FAILED_WORDS}
      onClose={props.onClose}
      onGone={props.onGone}>
      <CoverChoices chosen={chosen.id} onPick={pick} disabled={save.saving} named />
    </PickDialog>
  );
}
