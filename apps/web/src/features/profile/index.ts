// Public surface of the profile feature.
//
// Two names, different jobs: `handle` is the unique sluggable identity (assigned once,
// not rendered anywhere today), `displayName` is what people read on a deck.
export {
  // deck-builder's DecksPage imports it from here.
  /** @public */
  getAuthorNames,
  type PublicIdentity,
} from './profileRepository';
export {ProfileProvider, useProfile} from './ProfileContext';
export {DisplayNameDialog} from './components/DisplayNameDialog';
