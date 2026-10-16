import {useEffect, useRef, useState} from 'react';
import {CtaButton, DialogShell} from '../../shared/components';
import {COLORS, DIALOG_BODY, DIALOG_TITLE, FONTS, FONT_SIZES, SPACING} from '../../shared/constants';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {parseCollectionCsv, type CollectionEntries, type CollectionSummary} from './collectionParser';

interface ImportCollectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The card pool the CSV rows are joined against. */
  pool: readonly LorcanaCard[];
  /**
   * Whether {@link pool} is COMPLETE. Required, not optional-defaulting-true, on
   * purpose: the non-Core sets load lazily, so for the first few hundred ms after
   * the dialog opens `pool` holds only the 1,024 Core cards. Parsing against that
   * partial pool does not fail — it silently reclassifies every non-Core row as
   * "outside Core" and drops it, which is roughly two thirds of a real
   * collection. A caller that has not thought about this should not compile.
   */
  isPoolReady: boolean;
  /**
   * Why the pool could not load, or null. Required for the same reason as
   * {@link isPoolReady}: a failed load leaves the pool never ready, and a dialog
   * that only waited for it showed "Loading card list…" until the page was reloaded.
   */
  poolError: string | null;
  /** Load the pool again after a failure. A user action, like the binder's own Try again. */
  onRetryPool: () => void;
  /**
   * Store the parsed collection. Returns null on success, or a message to show.
   * Wired to `useCollection().importCollection` by the page; taken as a prop so
   * this component needs no provider in tests or stories.
   */
  onImport: (entries: CollectionEntries, importedAt: number) => string | null;
}

/** Thousands separators: these numbers run to four digits and get compared. */
function count(n: number): string {
  return n.toLocaleString();
}

/** `3 cards` / `1 card`. A real collection never hits the singular, but a nearly
 *  empty one does, and "Another 1 cards" is the kind of thing people screenshot. */
function plural(n: number, one: string, many: string): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/** Enough to act on; beyond this the list stops being readable. */
const MAX_LISTED = 8;

/** Card refs to list, the rest counted: `14-7, 3-999` or `... and 4 more`. */
function listed(refs: readonly string[]): string {
  const more = refs.length - MAX_LISTED;
  return `${refs.slice(0, MAX_LISTED).join(', ')}${more > 0 ? ` and ${count(more)} more` : ''}`;
}

/** A receipt line below the headline: what was left out, and why. */
const NOTE_STYLE: React.CSSProperties = {...DIALOG_BODY, fontWeight: 400, marginTop: SPACING.sm};

/**
 * The receipt, ALWAYS shown on success. The imported cards land in a mode the
 * user has not opened yet, so an import that said nothing would look like it had
 * done nothing.
 *
 * It names what could NOT be identified rather than counting it: five card
 * numbers are something a person can look up. Every set is stored, so there is
 * no "outside Core" remainder to explain away; a real import once lost Set 3's
 * lettered Dalmatian Puppies (4a-4e) behind a sentence like that. Rows that match
 * more than one printing get a line of their own: they are left out on purpose
 * (#553), and "could not be matched" would misstate why.
 */
function SummaryStep({summary}: {summary: CollectionSummary}) {
  const {unidentified, ambiguous, unparsed} = summary;
  return (
    <>
      <p style={{...DIALOG_BODY, marginTop: SPACING.xs}}>
        {plural(summary.cardsOwned, 'card', 'cards')}, {plural(summary.copiesOwned, 'copy', 'copies')}{' '}
        in all.
      </p>
      {unidentified.length > 0 && (
        <p style={NOTE_STYLE}>
          {unidentified.length === 1
            ? 'One card could not be matched to our data'
            : `${count(unidentified.length)} cards could not be matched to our data`}{' '}
          and {unidentified.length === 1 ? 'was' : 'were'} not imported: {listed(unidentified)}.
        </p>
      )}
      {ambiguous.length > 0 && (
        <p style={NOTE_STYLE}>
          {ambiguous.length === 1
            ? 'One card matches more than one printing in our data. We could not tell which you own, so it was'
            : `${count(ambiguous.length)} cards each match more than one printing in our data. We could not tell which you own, so they were`}{' '}
          not imported: {listed(ambiguous)}.
        </p>
      )}
      {unparsed.length > 0 && (
        <p style={NOTE_STYLE}>
          {plural(unparsed.length, 'row', 'rows')} could not be read, and{' '}
          {unparsed.length === 1 ? 'was' : 'were'} skipped.
        </p>
      )}
    </>
  );
}

/**
 * The file input is visually hidden rather than `display: none`, which some
 * browsers refuse to open a picker for. The visible `CtaButton` is what anyone
 * operates; it forwards the click. The input is out of the Tab order
 * (`tabIndex -1`), or keyboard users would land on an invisible stop with no
 * focus ring before reaching the button that does the same thing.
 */
const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/** What to upload, and where it comes from; or, when the card list failed to load, a retry. */
function ChooseStep({
  onPick,
  busy,
  isPoolReady,
  onRetry,
}: {
  onPick: (file: File) => void;
  busy: boolean;
  isPoolReady: boolean;
  /** Set when the card list failed to load: the button retries it instead of picking a file. */
  onRetry: (() => void) | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <p style={{...DIALOG_BODY, fontWeight: 400, marginTop: SPACING.xs}}>
        Export your collection from Dreamborn as CSV, then choose the file here. Importing
        replaces whatever collection Inkweave already has.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label="Collection CSV file"
        tabIndex={-1}
        // Off while a file is read, so a second pick cannot start a read of its own.
        disabled={busy}
        style={VISUALLY_HIDDEN}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset the input so choosing the SAME file twice still fires a change
          // event — otherwise a failed import cannot be retried with one click.
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
      {onRetry ? (
        <CtaButton variant="ghost" onClick={onRetry} style={{marginTop: SPACING.md, width: '100%'}}>
          Try again
        </CtaButton>
      ) : (
        <CtaButton
          variant="ghost"
          disabled={busy || !isPoolReady}
          onClick={() => inputRef.current?.click()}
          style={{marginTop: SPACING.md, width: '100%'}}>
          {busy ? 'Reading…' : isPoolReady ? 'Choose a CSV file' : 'Loading card list…'}
        </CtaButton>
      )}
    </>
  );
}

/** Mounted from the start, so the receipt's arrival is announced (focus goes to Done). */
function ImportStatus({summary}: {summary: CollectionSummary | null}) {
  return (
    <p role="status" style={VISUALLY_HIDDEN}>
      {summary && `Collection imported: ${plural(summary.cardsOwned, 'card', 'cards')}.`}
    </p>
  );
}

/** An import's own error first; else the card list's, which the step's Try again answers. */
function ImportError({error, poolError}: {error: string | null; poolError: string | null}) {
  const message = error ?? poolError;
  if (message === null) return null;
  return (
    <p
      role="alert"
      style={{
        ...DIALOG_BODY,
        fontWeight: 400,
        color: COLORS.error,
        fontSize: `${FONT_SIZES.sm}px`,
        marginTop: SPACING.sm,
      }}>
      {message}
    </p>
  );
}

/**
 * The receipt replaces the step whose button held focus. Hands focus to Done rather than
 * let it fall to the page: the dialog's trap listens on its panel, so focus outside it can
 * Tab to the page behind the scrim. Returns the ref for the footer that holds Done.
 */
function useFocusDoneOnReceipt(summary: CollectionSummary | null) {
  const footerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (summary) footerRef.current?.querySelector('button')?.focus();
  }, [summary]);
  return footerRef;
}

/**
 * Dreamborn collection import (#553). Takes the CSV export, joins it to the full
 * pool (Core plus the collection's non-Core sets) on `(set, number)`, and hands
 * the owned cards to `onImport`.
 *
 * A FILE, not a paste: a Dreamborn collection export is a census of every printed
 * card, 5329 rows and 300 KB, so a textarea would be the wrong instrument by two
 * orders of magnitude.
 */
export function ImportCollectionDialog({
  isOpen,
  onClose,
  pool,
  isPoolReady,
  poolError,
  onRetryPool,
  onImport,
}: ImportCollectionDialogProps) {
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Reset when the dialog OPENS, not when it closes: DialogShell keeps its
  // children through the exit fade, so clearing on close flipped the receipt back
  // to the file step while it faded out. Render-time, so the first frame is clean.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setSummary(null);
      setError(null);
      setBusy(false);
    }
  }
  /**
   * Bumped by every close, every new read and the unmount. An import still reading
   * the file when the user cancels, or leaves the page, must not land afterwards:
   * it would replace their collection behind a dialog they already dismissed. Nor
   * may an earlier read land after a later one. A ref, read after the await, because
   * state captured by that closure would still hold the value from before the cancel.
   */
  const attemptRef = useRef(0);
  useEffect(() => {
    const attempts = attemptRef;
    return () => {
      attempts.current += 1;
    };
  }, []);
  const footerRef = useFocusDoneOnReceipt(summary);

  const close = () => {
    attemptRef.current += 1;
    onClose();
  };

  const runImport = async (file: File) => {
    // The one funnel every import passes through, so the incomplete-pool guard
    // lives here rather than only on the button: a disabled button still leaves
    // the input itself drivable, and getting this wrong is silent.
    if (!isPoolReady) {
      setError('Still loading the full card list. Try again in a moment.');
      return;
    }
    attemptRef.current += 1;
    const mine = attemptRef.current;
    setBusy(true);
    setError(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      if (attemptRef.current !== mine) return;
      setBusy(false);
      setError('That file could not be read. Try exporting it from Dreamborn again.');
      return;
    }

    if (attemptRef.current !== mine) return;
    const {entries, summary: parsed} = parseCollectionCsv(text, pool);
    setBusy(false);

    // Nothing owned is not a storage failure, and must not be reported as one:
    // the likeliest cause is the wrong file, so say that instead.
    if (parsed.cardsOwned === 0) {
      setError('No owned cards were found in that file. Is it a Dreamborn collection export?');
      return;
    }

    const storageError = onImport(entries, Date.now());
    if (storageError !== null) {
      setError(storageError);
      return;
    }
    setSummary(parsed);
  };

  const title = summary ? 'Collection imported' : 'Import your collection';

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      ariaLabel="Import your collection"
      size="md"
      panelStyle={{padding: SPACING.xl, fontFamily: FONTS.body}}>
      <h2 style={DIALOG_TITLE}>{title}</h2>

      {summary ? (
        <SummaryStep summary={summary} />
      ) : (
        <ChooseStep
          onPick={(file) => void runImport(file)}
          busy={busy}
          isPoolReady={isPoolReady}
          onRetry={poolError === null ? null : onRetryPool}
        />
      )}

      <ImportStatus summary={summary} />
      <ImportError error={error} poolError={poolError} />

      <div ref={footerRef} style={{display: 'flex', gap: SPACING.sm, marginTop: SPACING.lg}}>
        {summary ? (
          <CtaButton onClick={close} style={{flex: 1}}>
            Done
          </CtaButton>
        ) : (
          <CtaButton variant="neutral" onClick={close} style={{flex: 1}}>
            Cancel
          </CtaButton>
        )}
      </div>
    </DialogShell>
  );
}
