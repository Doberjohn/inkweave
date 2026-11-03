import {FriendsSection} from '../features/friends/FriendsSection';
import {useFriends} from '../features/friends/useFriends';
import {Section} from './AccountPage';

/**
 * The account page's Friends section (#852), wired to the player's friendships. A module of
 * its own, which the page loads lazily, so the friends code stays out of the account route's
 * chunk. The section's UI lives in `features/friends`; this module only frames it with the
 * page's `Section` and feeds it.
 */
export function AccountFriends({userId}: {userId: string}) {
  const friends = useFriends(userId);
  return (
    <Section title="Friends">
      <FriendsSection
        status={friends.status}
        code={friends.code}
        received={friends.received}
        sent={friends.sent}
        friends={friends.friends}
        busy={friends.busy}
        onRetry={friends.retry}
        onSend={friends.send}
        onAccept={friends.accept}
        onRemove={friends.remove}
        sharing={friends.sharing}
      />
    </Section>
  );
}
