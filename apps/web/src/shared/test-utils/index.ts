export {
  createCard,
  createSynergyMatch,
  createSynergyGroup,
  createConnection,
  createVotingPair,
} from './factories';
export {swipeCard} from 'inkweave-ui/test-utils/printingSwipe';
export {fingerMove, touchMoveKept} from 'inkweave-ui/test-utils/touchMove';
export {fakeAccessToken} from './supabaseSession';
// Note: setup.ts is imported by vitest.config.ts, not re-exported here
