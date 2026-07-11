// Route layout for `/decks/*` (#466). Mounts DeckProvider (under CardDataProvider,
// via AppLayout) so the whole deck subtree shares one working draft: the draft survives
// navigation between the list, builder, and view routes, and flushes to localStorage
// when the user leaves the section.
import {Outlet} from 'react-router-dom';
import {DeckProvider} from '../features/deck/state';

export function DeckLayout() {
  return (
    <DeckProvider>
      <Outlet />
    </DeckProvider>
  );
}
