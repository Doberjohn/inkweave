import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useBrowseCollection} from '../features/collection/useBrowseCollection';
import {BrowseBody} from './BrowsePage';

/**
 * Browse with collection mode (#553 Phase C): the route's page while `SHOW_COLLECTION` is
 * on (see `router.tsx`). It wires collection mode's slots into Browse's own content, and
 * lives apart from `BrowsePage` so the flag-off page holds no static path into the
 * collection feature, whose data layer would otherwise load on Browse for everyone.
 */
export function BrowseCollectionPage() {
  const {cards} = useCardDataContext();
  return <BrowseBody collection={useBrowseCollection(cards)} />;
}
