/**
 * Set-composition constants for the reveals tracker.
 *
 * The values live in shared/constants/revealSet.ts, the one per-season file,
 * because reveal-admin validates collector numbers against the same ink blocks.
 * Re-exported here so the reveals components keep importing them locally.
 */
export {PER_INK, SET_TOTAL} from '../../shared/constants';
