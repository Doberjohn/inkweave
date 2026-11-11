import {useEffect, useState, useSyncExternalStore} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries} from './collectionParser';
import {SHOW_BINDERS} from './binders/flag';
import type {BinderShelf} from './binders/shelfStore';
import type {CustomBinder, OwnBinders, OwnBindersAsk} from './binders/binderChoices';

/**
 * The reader's own binders for Browse: the shelf, the binder `?custom=` names, and the
 * cards it holds.
 *
 * OFF MEANS NOT LOADED (`binders/flag.ts`). Every binder module comes in one chunk
 * (`binders/ownBinders.ts`), loaded once collection mode wants the binders, through an import the
 * bundler folds away with the flag off: a static import it would keep, as code no page runs, and
 * `binderCodeGuard` fails such a build. So this hook holds only the wiring, and until the chunk
 * is in, a binder asked for loads, as it does while the shelf reads.
 */

type BinderModule = typeof import('./binders/ownBinders');

const importBinders = SHOW_BINDERS ? () => import('./binders/ownBinders') : null;

/** The chunk once loaded, for every later mount; and the one request for it, shared until it settles. */
let loaded: BinderModule | null = null;
let request: Promise<BinderModule> | null = null;

/**
 * The chunk, or a throw for an import that resolved empty: how a failed download arrives in a
 * production build, where main.tsx cancels Vite's preload error to reload onto the new deploy.
 */
function present(module: BinderModule | undefined): BinderModule {
  if (!module) throw new Error('The binder chunk resolved empty');
  return module;
}

/** Loads the binder chunk through `load` once for the page: a failure, an empty import among them, is asked for again next time. */
export function loadBinders(load: () => Promise<BinderModule | undefined>): Promise<BinderModule> {
  request ??= load()
    .then(present)
    .then(
      (module) => (loaded = module),
      (error: unknown) => {
        // A failed chunk can be asked for again (Try again).
        request = null;
        throw error;
      },
    );
  return request;
}

/** The binder chunk, loaded the first time `wanted`; and whether that failed, with its Try again. */
function useBinderModule(wanted: boolean) {
  const [module, setModule] = useState<BinderModule | null>(loaded);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (importBinders === null || !wanted) return undefined;
    if (module !== null) return undefined;
    let live = true;
    loadBinders(importBinders).then(
      (next) => live && setModule(next),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [module, wanted, attempt]);
  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };
  return {module, failed, retry};
}

const noSubscribe = () => () => {};
const nothingHeld = () => null;
const NO_RETRY = () => {};

/** The shelf's status before the chunk is in: as the store will say it (`viewOf`), or failed to load. */
function statusBeforeLoad({uid, syncing, wanted}: OwnBindersAsk, failed: boolean): BinderShelf['status'] {
  if (failed) return 'failed';
  return uid !== null && !syncing && wanted ? 'loading' : 'idle';
}

/** Before the chunk is in: binders off, or on and loading, or failed to load, with its Try again. */
function beforeLoad(ask: OwnBindersAsk, pool: LorcanaCard[], load: {failed: boolean; retry: () => void}): OwnBinders {
  if (!SHOW_BINDERS) return {shelf: null, custom: {status: 'none'}, pool, offerOf: null};
  const status = statusBeforeLoad(ask, load.failed);
  const shelf: BinderShelf = {status, binders: [], retry: load.failed ? load.retry : NO_RETRY};
  const custom: CustomBinder =
    ask.requested === null ? {status: 'none'} : load.failed ? {status: 'failed', retry: load.retry} : {status: 'loading'};
  return {shelf, custom, pool, offerOf: null};
}

/**
 * Your binders: read once for the visit when collection mode `wanted` them (`binders/shelfStore.ts`),
 * and the binder `?custom=` names over the whole `pool`, its cards and its cover.
 */
export function useOwnBinders(ask: OwnBindersAsk, pool: LorcanaCard[], entries: CollectionEntries): OwnBinders {
  const {module, ...load} = useBinderModule(ask.wanted || ask.requested !== null);
  const held = useSyncExternalStore(module?.subscribe ?? noSubscribe, module?.snapshot ?? nothingHeld);
  const {uid, hasCollection, syncing, wanted} = ask;
  useEffect(() => module?.follow({uid, hasCollection, syncing, wanted}), [module, uid, hasCollection, syncing, wanted]);
  return module === null ? beforeLoad(ask, pool, load) : module.ownBindersOf(held, ask, pool, entries);
}
