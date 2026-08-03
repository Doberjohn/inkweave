# Deck save, list, publish and share (#473): design

**Status:** agreed 2026-08-01. Implements PLAN items 27-29 plus `listPublicDecks`
(scope addition recorded on #473).

**Goal:** a deck can be saved to an account, found in a list, opened, published,
and shared. Today none of those are possible: `deckRepository` is fully built and
entirely uncalled.

## Why now

The owner has Set 13 decks to publish. Going through the real save-and-publish
flow is what proves this path works, instead of seeding static JSON with
manufactured provenance. Those decks then become the community tab's first
content.

## What already exists

Do not rebuild any of this.

| Layer | State |
|---|---|
| `decks` table | `is_public boolean not null default false`, owner FK, `cards jsonb` |
| RLS | `decks_select_public_or_own using (is_public or auth.uid() = owner_id)`, so **anon can already read public decks** |
| Index | `decks_public_updated_idx on (updated_at desc) where is_public` |
| `deckRepository` | `listDecks(ownerId)`, `getDeck(id)`, `createDeck`, `updateDeck`, `deleteDeck`, `upsertDeck`. All uncalled |
| Routes | `/decks`, `/decks/new`, `/decks/:id`, `/decks/:id/edit` all registered |
| `DeckContext` | one working draft, debounced localStorage persistence, `useFirstSignInMigration` |
| `deckTransfer` | decklist import/export, matched by name |

## Decisions

Each was an explicit owner ruling during the 2026-08-01 design session.

### A. Cloud is the library; local stays one draft

`localStorage` holds exactly one working draft under `DRAFT_KEY`. Saving upserts
it into `decks` and binds it to that row. A signed-in user's library lives in the
cloud. A guest has exactly one deck, on that browser.

**Rejected: A+ (a local library of many decks).** It removes the one-deck cap, but
it also removes the main reason to register. Under A+ everything works locally
forever, leaving only publishing, cross-device, and loss protection as pitches,
none of which fire during normal use. The cap is the forcing function.

**Rejected: removing local storage, and gating `/decks` behind auth.** Both delete
guest complexity, and both cost more than they save. Removing local moves ~260
deleted lines into async loading state in `DeckContext`, kills offline use, and
makes data loss *more* likely once auto-save is off the table. Gating the route
additionally makes `is_public`, the anon-read RLS policy, and the feed index
unreachable, which would make publishing a no-op and share links useless.

### A1. Explicit save, never automatic

Local persistence stays automatic and debounced, so **work is never lost**. The
cloud copy changes only when the user saves. The builder shows an unsaved-changes
state.

Decisive reason: decks can be public. Auto-save would put half-edited states in
front of visitors the moment a card is touched. A1 keeps "what is published"
separate from "what I am fiddling with" without extra machinery.

### P1. Explicit publish, chosen at creation, default Private

Visibility is offered when a deck is created, defaulting to **Private**, and stays
changeable afterwards from the deck itself. Because save is explicit, a
creation-time choice is a **pending intent on the draft, applied at first save**.

`ShareDeckButton` copies a link. If the deck is private it says so and offers to
publish rather than publishing silently. Publishing puts the owner's deck on a
page strangers can read, so it is never a side effect of trying to share.

**There is no "unlisted" tier.** RLS reads `is_public or owner`, so a deck is
either readable by everyone or by nobody else. Shareable-but-hidden would need a
new column and a live migration, which is out of scope.

### L1. Only Core-legal public decks are listed

The community list shows public decks passing `calculateDeckStats().isLegal`, the
same gate "Play on Duels" already uses. Public-but-incomplete decks stay saved and
stay linkable, but do not appear in the list.

Reuses the single existing definition of a valid deck rather than inventing a
second one, exactly as the toolbar gate did when it chose `isLegal` over a card
count (a 60-card deck can still break copy or ink rules).

### Guests can build; Save is the conversion point

The builder works fully signed out. `Save to account` prompts sign-in, which is
two-click Google or Discord OAuth (#463), and `useFirstSignInMigration` then
promotes the existing draft into the new account automatically. The user loses
nothing and gains a library.

The second "New deck" is the other trigger: it replaces the current deck, so it
warns first and offers sign-in in the same breath.

## Architecture

### 1. Deck identity and lifecycle (the root fix)

`DeckBuilderPage` currently has no reset on mount and never reads `:id`, so
`/decks/new` and `/decks/:id/edit` are the same page over the same draft. **"+ New
deck" creates nothing and a saved deck cannot be opened.** Everything else depends
on fixing this.

`DeckContext` gains:

- `isDirty: boolean`: set by every mutation, cleared on save and on load.
- `startNewDeck(visibility: 'private' | 'public'): void`: resets the draft to
  empty and unbound (`id` regenerated, `ownerId` cleared), recording the pending
  visibility on the draft's `isPublic`.
- `loadDeck(deck: Deck): void`: replaces the draft with a fetched deck, bound and
  clean.

`Deck` already carries `id`, `ownerId` and `isPublic`, so **no type change and no
`schemaVersion` bump**.

**`isDirty` persists under its own localStorage key**, not inside the draft.
Putting it on `Deck` would change the persisted shape, forcing a `schemaVersion`
bump, and would then be written into the `decks.cards` jsonb column where a
client-side edit flag has no business being. A separate key keeps "unsaved
changes" surviving a reload without touching the deck schema.

### 1a. Creating a deck

"+ New deck" currently navigates straight to `/decks/new`. It becomes a small
dialog first, because visibility is chosen at creation (P1):

- **Name** (optional at this stage; `SaveDeckDialog` requires it).
- **Private / Public**, defaulting to Private. For a guest, Public is **shown but
  disabled**, labelled "Sign in to publish", so nobody picks a state that silently
  will not happen.
- **Replace warning, guests only, and only when a non-empty draft exists:**
  "Starting a new deck replaces your current one, which isn't saved to an account
  yet." Sign-in is offered in the same dialog. Signed in, no warning is needed:
  the current deck is either saved or savable.

On confirm it calls `startNewDeck(visibility)` and navigates to `/decks/new`.

### 2. Saving

`SaveDeckDialog` (new, `features/deck/components/`): name field, inks shown as
derived (never entered), and the visibility state. On confirm it calls
`upsertDeck(deck, ownerId)`, binds the returned row, and clears `isDirty`.

Signed out, the dialog is replaced by the sign-in prompt; the deck is untouched.

### 3. Listing

`DecksPage` gains `TabList` with **Community** (default) and **My decks**.

- Community calls a new `listPublicDecks(limit)` in `deckRepository`, ordered
  `updated_at desc` to match the existing partial index, then filters to
  `isLegal` client-side. It must be client-side: the signature is
  `calculateDeckStats(deck, getCardById)`, and `isLegal` is
  `totalCards >= 60 && withinCopyLimit && inkCount <= 2`, so it needs per-card ink
  and identity that live in `allCards.json`, not in the `decks` row, which stores
  only `{cardId, quantity}`. Card data is available: `AppLayout` mounts
  `CardDataProvider` above the whole route tree, and `DeckLayout` sits under it.
- My decks calls `listDecks(ownerId)` when signed in, and shows the single local
  draft when not.

Community is the default tab for everyone, signed in or not, because that is the
page's ruled identity.

### 4. Viewing

`DeckViewPage` replaces its placeholder: fetch by `:id` via `getDeck`, render a
read-only card list with the deck's stats. Owner sees `Edit`, `Share` and the
visibility control; a visitor sees the deck and `Share` only.

### 5. Sharing

`ShareDeckButton` copies `/decks/:id` to the clipboard. Private decks get the
publish offer described in P1.

## Error handling

- **Save fails** (network, RLS, auth expiry): the local draft is untouched and
  stays dirty; the dialog reports the failure and stays open. Never silently
  discard.
- **Deck not found, or private and not yours:** RLS returns no row, so these are
  indistinguishable, and deliberately so. Show one "not found" state; do not leak
  whether an id exists.
- **`/decks/:id/edit` for a deck you do not own:** treated as not found rather than
  redirected, for the same reason.
- **`listPublicDecks` fails:** the Community tab shows a retryable error, not an
  empty list, so a network failure never reads as "no decks exist".

## Empty states

- **My decks, signed in, none saved:** invite to build, linking `/decks/new`.
- **My decks, guest:** the local draft if there is one, otherwise the same invite.
- **Community, nothing published:** an honest note that no decks have been shared
  yet, with a build invitation. Not an error.

## Testing

**Unit:** `DeckContext` dirty tracking across mutation, save and load;
`startNewDeck` unbinding; `listPublicDecks` shape and ordering; the `isLegal`
filter (a public 47-card deck must not be listed).

**E2E** (the issue's stated contract): build a deck, reach 60 with legality green,
save under a stubbed session, then open the share link **in a fresh browser
context** to prove anon read works through RLS.

This requires **session stubbing, which does not exist anywhere in the suite
today**. It has to be built here, and it is a prerequisite for every other E2E in
this issue. `navigation.spec.ts` is currently the only spec touching `/decks`.

## Out of scope

Deferred to #454: favourites, `deck_stats`, copy-a-deck, `/u/:handle` profiles,
trending. Deferred generally: an unlisted visibility tier, deck versioning,
multi-deck local storage (A+).
