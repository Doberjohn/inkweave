import {useRef, useState, type CSSProperties} from 'react';
import {CtaButton} from '../../../shared/components';
import {trackEvent} from '../../../shared/lib/analytics';
import {COLORS, DIALOG_TITLE, FONT_SIZES, SPACING, TABULAR} from '../../../shared/constants';
import {WHOLE_COLLECTION, scopeName} from '../binderCards';
import {percentOf} from '../collectionStats';
import type {SaveOffer} from './binderChoices';
import {AskDialog, NameField, ProblemLine, WhenGone, type SaveProblem} from './binderDialogs';
import {CHIP, CHIPS, HEADING, LEAD} from './binderFields';
import {isValidBinderName, trimBinderName} from './binderName';
import {ruleKinds, ruleParts, type Binder} from './binderRules';
import {createBinder} from './binderShelf';
import {suggestName} from './saveRules';
import {cardCount} from './shelfWords';
import type {NewStart} from './useBinderDraft';

export interface SaveAsBinderProps {
  isOpen: boolean;
  /** What the page's filters make (`saveOffer`), as they stood when Save as a binder was pressed. */
  offer: SaveOffer;
  /** Whose shelf: the save waits in their write queue. */
  readerId: string;
  isMobile: boolean;
  /** Told once the server has the binder, as it stored it; the caller closes the box. */
  onSaved: (binder: Binder) => void;
  /** More rules: the window takes over from the box, with its name, Sets and rules. */
  onMoreRules: (seed: NewStart) => void;
  onClose: () => void;
  /** Told once a closed box's exit has run, so the page can unmount it. */
  onGone: () => void;
}

/** What the box is called: our words, never the binder's name, which stays out of attributes. */
const DIALOG_NAME = 'Save as a binder';

/** "Every set", or the Sets the set picker had picked, as a chip after the rules'. */
const setsChip = (scope: string) => (scope === WHOLE_COLLECTION ? 'All sets' : scopeName(scope));

/** "625 cards, you have 293, 46%". */
function countLine({figures, scope}: SaveOffer): string {
  return `${cardCount(figures.cards, scope)}, you have ${figures.complete.toLocaleString('en-US')}, ${percentOf(figures.complete, figures.cards)}%`;
}

/** Makes the binder from the box's name and the offer's Sets and rules, and counts it once it lands: never its name. */
async function saveOffered(readerId: string, name: string, {scope, rules}: SaveOffer) {
  const made = await createBinder({readerId, input: {name: trimBinderName(name), scope, rules, coverId: null}});
  if ('binder' in made) trackEvent('binder_created', {from: 'saved', kinds: ruleKinds(made.binder)});
  return made;
}

/**
 * The save, and what it came to. While it runs every way out waits, as the window's does: the box
 * alone would say it failed. A failure keeps the name.
 */
function useSave({readerId, offer, onSaved, onClose}: Pick<SaveAsBinderProps, 'readerId' | 'offer' | 'onSaved' | 'onClose'>) {
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const save = async (name: string) => {
    setSaving(true);
    setProblem(null);
    const made = await saveOffered(readerId, name, offer);
    setSaving(false);
    if ('problem' in made) setProblem(made.problem);
    else onSaved(made.binder);
  };
  const close = () => {
    if (!saving) onClose();
  };
  return {saving, problem, save: (name: string) => void save(name), close};
}

const HOLDS: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.sm, marginTop: SPACING.lg};

const COUNT: CSSProperties = {...TABULAR, margin: 0, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

const BUTTONS: CSSProperties = {display: 'flex', gap: SPACING.sm, marginTop: SPACING.xl};

/**
 * Save as a binder's box: the page's filters kept as a binder of their own. Its name starts as
 * `suggestName`'s, selected; under it what the binder holds, its rules and Sets as chips and its
 * count. Save binder makes it at the set the page had picked; More rules hands it to the New
 * binder window. A dialog on a computer and a tablet, a sheet on a phone, where focus starts on the
 * sheet so the keyboard waits for a press on the name.
 *
 * Lazy, in a chunk of its own, and only with binders on (`flag.ts`). It carries `ph-no-capture`:
 * the name is the player's own words.
 */
export function SaveAsBinder(props: SaveAsBinderProps) {
  const {offer, isMobile} = props;
  const [name, setName] = useState(() => suggestName(offer));
  const save = useSave(props);
  const nameRef = useRef<HTMLInputElement>(null);
  const chips = [...ruleParts({scope: WHOLE_COLLECTION, rules: offer.rules}), setsChip(offer.scope)];
  return (
    <AskDialog
      isOpen={props.isOpen}
      isMobile={isMobile}
      onClose={save.close}
      dialogName={DIALOG_NAME}
      size="sm"
      initialFocusRef={isMobile ? undefined : nameRef}>
      <div className="ph-no-capture">
        <WhenGone onGone={props.onGone} />
        <h2 style={DIALOG_TITLE}>Save as a binder</h2>
        <p style={LEAD}>Keep these filters as a binder of their own.</p>
        <NameField value={name} onChange={setName} disabled={save.saving} inputRef={nameRef} />
        <section style={HOLDS}>
          <h3 style={HEADING}>It holds</h3>
          <ul aria-label="Its rules" style={CHIPS}>
            {chips.map((chip) => (
              <li key={chip} style={CHIP}>
                {chip}
              </li>
            ))}
          </ul>
          <p style={COUNT}>{countLine(offer)}</p>
        </section>
        <ProblemLine problem={save.problem} style={{marginTop: SPACING.md}} />
        <div style={BUTTONS}>
          <CtaButton
            variant="neutral"
            disabled={save.saving}
            onClick={() => props.onMoreRules({name, scope: offer.scope, rules: offer.rules})}
            style={{flex: 1}}>
            More rules
          </CtaButton>
          <CtaButton disabled={!isValidBinderName(name) || save.saving} onClick={() => save.save(name)} style={{flex: 1}}>
            {save.saving ? 'Saving…' : 'Save binder'}
          </CtaButton>
        </div>
      </div>
    </AskDialog>
  );
}
