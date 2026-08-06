// Public surface of the profile feature.
//
// Two names, different jobs: `handle` is the unique sluggable identity (assigned once,
// not rendered anywhere today), `displayName` is what people read on a deck.
export {
  claimIdentity,
  getAuthorNames,
  updateDisplayName,
  isValidDisplayName,
  DISPLAY_NAME_MIN,
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_RULE,
  type PublicIdentity,
} from './profileRepository';
export {ProfileProvider, useProfile} from './ProfileContext';
export {DisplayNameDialog} from './components/DisplayNameDialog';
