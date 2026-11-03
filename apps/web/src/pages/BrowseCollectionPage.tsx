import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useBrowseCollection} from '../features/collection/useBrowseCollection';
import {BrowseBody} from './BrowsePage';

/**
 * Browse's route page (`router.tsx`): it wires collection mode's slots (#553 Phase C) into
 * Browse's own content. Its chunk holds collection mode's code, which the root
 * `package.json` budgets apart from the User-facing JS.
 */
export function BrowseCollectionPage() {
  const {cards} = useCardDataContext();
  return <BrowseBody collection={useBrowseCollection(cards)} />;
}
