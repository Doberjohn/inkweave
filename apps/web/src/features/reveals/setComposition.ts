/**
 * Set-composition constants for the reveals tracker.
 *
 * The values live in shared/constants/revealSet.ts, the one per-season file,
 * because admin's reveal publisher validates collector numbers against the same ink
 * blocks (Doberjohn/inkweave-admin reads them through its pinned copy of this repo).
 * Re-exported here so the reveals components keep importing them locally.
 */
export {PER_INK, SET_TOTAL} from '../../shared/constants';
