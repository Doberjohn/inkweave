import * as React from 'react';
import * as S from "@ds-stories/apps/web/src/features/collection/ImportCollectionDialog.stories";

function compose(S: any, key: string) {
  const meta: any = S.default ?? {};
  const st: any = S[key];
  const args: any = { ...(meta.args ?? {}), ...(st && st.args ? st.args : {}) };
  // Storybook resolves argTypes.mapping (control value -> real arg) before
  // rendering; mirror that so mapped args don't render raw.
  const at: any = { ...(meta.argTypes ?? {}), ...(st && st.argTypes ? st.argTypes : {}) };
  for (const k of Object.keys(args)) {
    const m = at[k] && at[k].mapping;
    if (m && typeof m === 'object' && args[k] in m) args[k] = m[args[k]];
  }
  const title: string = typeof meta.title === 'string' ? meta.title : '';
  const ctx: any = {
    args, name: key, title, kind: title, id: '', componentId: '',
    globals: {}, viewMode: 'story',
    parameters: (st && st.parameters) ?? meta.parameters ?? {},
  };
  let render: (() => any) | null = null;
  if (st && typeof st.render === 'function') render = () => st.render(args, ctx);
  else if (typeof st === 'function') render = () => st(args, ctx);
  else if (typeof meta.render === 'function') render = () => meta.render(args, ctx);
  else {
    const C = (st && st.component) || meta.component;
    if (C) render = () => React.createElement(C, args);
  }
  if (!render) return () => null;
  // [].concat: a single function is legal CSF decorator shorthand. A
  // decorator returning undefined (stubbed addon) falls through to the inner
  // render — otherwise one unrecognized addon blanks the cell silently.
  const decorators: any[] = ([] as any[]).concat((st && st.decorators) ?? []).concat(meta.decorators ?? []);
  return decorators.reduce((inner: any, dec: any) => () => {
    const out = dec(inner, ctx);
    return out === undefined ? inner() : out;
  }, render);
}

/*
 * OWNED because three of these four stories are PLAY-DRIVEN and the generated
 * `compose` above composes only `meta.decorators` + `story.render` — it has no
 * notion of `play`. Storybook runs the play function before the reference shot,
 * so the reference showed the receipt / the two error rows while the preview
 * showed the untouched file picker on all three: same component, wrong state.
 *
 * `summary` and `error` are internal `useState` with no prop to set them
 * (ImportCollectionDialog.tsx:158-159), and the story's own docblock says so —
 * so the ONLY faithful way to reach those states is the one the play function
 * uses: put a File on the hidden `<input type="file">` and let the component's
 * own onChange handler run. Nothing about the story's open state is neutralised;
 * this replays the story's interaction rather than short-circuiting it.
 *
 * The CSV fixtures below are copied from the story module because they are
 * module-local consts there, not exports.
 */

/** Mirrors `CSV` in ImportCollectionDialog.stories.tsx. */
const CSV = [
  'Set Number,Card Number,Variant,Count,Name,Color,Rarity',
  '011,191,normal,4,"Angel - Experiment 624",Amber,Rare',
  '011,191,foil,1,"Angel - Experiment 624",Amber,Rare',
  '011,20,normal,2,"Nani - Stage Manager",Amber,Common',
  '011,24,normal,0,"Bambi - Ethereal Fawn",Amber,Common',
  '004,101,normal,3,"An Older Card",Ruby,Common',
].join('\n');

/** Mirrors the inline fixture in the `NothingOwned` play function. */
const EMPTY_CSV =
  'Set Number,Card Number,Variant,Count,Name,Color,Rarity\n011,191,normal,0,"Angel",Amber,Rare';

/**
 * The `userEvent.upload(screen.getByLabelText('Collection CSV file'), file)`
 * equivalent. React routes file inputs through the native `change` event (they
 * are exempt from its value-tracking dedupe), so assigning `files` from a
 * DataTransfer and dispatching a bubbling `change` reaches the component's own
 * onChange. The dialog portals to document.body, hence the document-wide query
 * and the rAF: the portal is committed by the time effects flush, but the extra
 * frame keeps this robust if DialogShell's mount ever moves behind a transition.
 */
function useUpload(contents: string, name: string) {
  React.useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      const input = document.querySelector<HTMLInputElement>(
        'input[aria-label="Collection CSV file"]',
      );
      if (!input) return;
      const dt = new DataTransfer();
      dt.items.add(new File([contents], name, {type: 'text/csv'}));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', {bubbles: true}));
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [contents, name]);
}

function withUpload(Inner: any, contents: string, name: string) {
  return function PlayDrivenStory() {
    useUpload(contents, name);
    return React.createElement(Inner);
  };
}

export const ChooseAFile = /* Choose A File */ compose(S, "ChooseAFile");
export const Imported = /* Imported */ withUpload(compose(S, "Imported"), CSV, 'collection.csv');
export const StorageRefused = /* Storage Refused */ withUpload(
  compose(S, "StorageRefused"),
  CSV,
  'collection.csv',
);
export const NothingOwned = /* Nothing Owned */ withUpload(
  compose(S, "NothingOwned"),
  EMPTY_CSV,
  'empty.csv',
);
